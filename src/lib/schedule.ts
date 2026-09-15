import type { CardKind, CardState, DayQueue, Result } from "./types";
import { addDays } from "./dates";

/** 成功前所在盒子 → 下次间隔（天） */
export const INTERVALS = [1, 2, 4, 7, 15];
export const MAX_BOX = 5;
export const GROUP_SIZE = 3;

const SUCCESS: Result[] = ["did", "remembered"];
const COUNTS_FOR_STREAK: Result[] = ["did", "remembered", "vague", "forgot"];

export function newCardState(id: string, kind: CardKind, addedAt: number): CardState {
  return { id, kind, status: "queued", box: 0, due: null, introducedAt: null, addedAt, history: [] };
}

export function resultOn(state: CardState, date: string): Result | undefined {
  return state.history.find((h) => h.date === date)?.result;
}

/** 规范 §5.1 的转换表。纯函数；同一天重复结果返回原状态。 */
export function applyResult(state: CardState, result: Result, date: string): CardState {
  if (resultOn(state, date)) return state;
  const history = [...state.history, { date, result }];
  if (SUCCESS.includes(result)) {
    if (state.box >= MAX_BOX) return { ...state, status: "internalized", due: null, history };
    return { ...state, box: state.box + 1, due: addDays(date, INTERVALS[state.box]), history };
  }
  if (result === "forgot") return { ...state, box: Math.max(0, state.box - 1), due: addDays(date, 1), history };
  // later / vague
  return { ...state, due: addDays(date, 1), history };
}

function cmpDue(a: CardState, b: CardState): number {
  if (a.box !== b.box) return a.box - b.box;
  if (a.due !== b.due) return a.due! < b.due! ? -1 : 1;
  if (a.addedAt !== b.addedAt) return a.addedAt - b.addedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function cmpQueued(a: CardState, b: CardState): number {
  if (a.addedAt !== b.addedAt) return a.addedAt - b.addedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function unmarked(state: CardState, date: string): boolean {
  return resultOn(state, date) === undefined;
}

function keepPresent(states: Record<string, CardState>, ids: string[] | undefined): string[] {
  return (ids ?? []).filter((id) => states[id] && states[id].status !== "dismissed");
}

/** 混排一组 ≤3。先丢掉 dismissed/缺失；有幸存者则冻结，否则从到期卡再 queued 取。 */
export function buildGroup(
  states: Record<string, CardState>,
  date: string,
  existing?: DayQueue,
): { queue: DayQueue; states: Record<string, CardState> } {
  const next: Record<string, CardState> = { ...states };
  const existingIds = existing && Array.isArray(existing.ids) ? existing.ids : undefined;
  const kept = keepPresent(next, existingIds);
  if (kept.length > 0) return { queue: { ids: kept }, states: next };

  const due = Object.values(next)
    .filter((s) => unmarked(s, date) && s.status === "active" && s.due !== null && s.due <= date)
    .sort(cmpDue);
  const fresh = Object.values(next)
    .filter((s) => unmarked(s, date) && s.status === "queued")
    .sort(cmpQueued);

  const ids: string[] = [];
  for (const s of due) {
    if (ids.length >= GROUP_SIZE) break;
    ids.push(s.id);
  }
  for (const s of fresh) {
    if (ids.length >= GROUP_SIZE) break;
    next[s.id] = { ...s, status: "active", introducedAt: date, due: date };
    ids.push(s.id);
  }
  return { queue: { ids }, states: next };
}

export function groupComplete(states: Record<string, CardState>, date: string, queue: DayQueue): boolean {
  return keepPresent(states, queue.ids).every((id) => resultOn(states[id], date) !== undefined);
}

/** 今日页空态与刷新。须在 ensureQueue 之后调用。 */
export function todayFlags(
  states: Record<string, CardState>,
  date: string,
  queue: DayQueue,
): {
  libraryEmpty: boolean;
  completedToday: boolean;
  groupDone: boolean;
  showRefresh: boolean;
  refreshEnabled: boolean;
  sealed: boolean;
} {
  const present = keepPresent(states, queue.ids);
  const hasGroup = present.length > 0;
  const practicing = Object.values(states).some((s) => s.status === "queued" || s.status === "active");
  const anyToday = Object.values(states).some((s) => resultOn(s, date) !== undefined);
  const anySuccessToday = Object.values(states).some((s) => {
    const r = resultOn(s, date);
    return r !== undefined && SUCCESS.includes(r);
  });
  const libraryEmpty = !hasGroup && !practicing && !anyToday;
  const completedToday = !hasGroup && !libraryEmpty;
  const groupDone = groupComplete(states, date, queue);
  return {
    libraryEmpty,
    completedToday,
    groupDone,
    showRefresh: hasGroup,
    refreshEnabled: hasGroup && groupDone,
    sealed: hasGroup ? groupDone && present.some((id) => {
      const r = resultOn(states[id], date);
      return r !== undefined && SUCCESS.includes(r);
    }) : completedToday && anySuccessToday,
  };
}

/** 组内未全部标记则冻结原组；否则从剩余未标记取下一组，没有则空（不绕回）。 */
export function advanceGroup(
  states: Record<string, CardState>,
  date: string,
  existing: DayQueue,
): { queue: DayQueue; states: Record<string, CardState> } {
  if (!groupComplete(states, date, existing)) return buildGroup(states, date, existing);
  return buildGroup(states, date);
}

/** 规范 §5.3 */
export function streak(states: Record<string, CardState>, date: string): number {
  const days = new Set<string>();
  for (const s of Object.values(states)) for (const h of s.history) if (COUNTS_FOR_STREAK.includes(h.result)) days.add(h.date);
  let cursor = days.has(date) ? date : addDays(date, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** 规范 §5.4 */
export function summarize(states: Record<string, CardState>) {
  const out = { internalized: 0, active: 0, queued: 0 };
  for (const s of Object.values(states)) if (s.status in out) out[s.status as keyof typeof out]++;
  return out;
}
