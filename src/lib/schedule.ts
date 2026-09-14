import type { CardKind, CardState, DayQueue, Result } from "./types";
import { addDays } from "./dates";

/** 成功前所在盒子 → 下次间隔（天） */
export const INTERVALS = [1, 2, 4, 7, 15];
export const MAX_BOX = 5;
export const CAPS: Record<CardKind, number> = { action: 3, flash: 5 };
export const NEW_PER_DAY: Record<CardKind, number> = { action: 2, flash: 3 };

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

function queueKey(kind: CardKind): keyof DayQueue {
  return kind === "action" ? "actions" : "flash";
}

/** 规范 §5.2。纯函数、幂等；返回新的队列与更新后的状态表。 */
export function buildQueue(
  states: Record<string, CardState>,
  date: string,
  existing?: DayQueue,
): { queue: DayQueue; states: Record<string, CardState> } {
  const next: Record<string, CardState> = { ...states };
  const queue: DayQueue = { actions: [], flash: [] };

  for (const kind of ["action", "flash"] as CardKind[]) {
    const key = queueKey(kind);
    const cap = CAPS[kind];
    // 1. 冻结队列：保留仍存在且未被取消的卡
    const kept = (existing?.[key] ?? []).filter((id) => next[id] && next[id].status !== "dismissed");
    const inQueue = new Set(kept);
    const occupied = () => kept.filter((id) => resultOn(next[id], date) !== "later").length;

    // 2. 到期卡
    const due = Object.values(next)
      .filter((s) => s.kind === kind && s.status === "active" && s.due !== null && s.due <= date && !inQueue.has(s.id))
      .sort((a, b) => a.box - b.box || (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : 0) || a.addedAt - b.addedAt);
    for (const s of due) {
      if (occupied() >= cap) break;
      kept.push(s.id);
      inQueue.add(s.id);
    }

    // 3. 新卡
    const introducedToday = Object.values(next).filter((s) => s.kind === kind && s.introducedAt === date).length;
    let budget = Math.min(NEW_PER_DAY[kind] - introducedToday, cap - occupied());
    if (budget > 0) {
      const fresh = Object.values(next)
        .filter((s) => s.kind === kind && s.status === "queued")
        .sort((a, b) => a.addedAt - b.addedAt || (a.id < b.id ? -1 : 1));
      for (const s of fresh) {
        if (budget <= 0) break;
        next[s.id] = { ...s, status: "active", introducedAt: date, due: date };
        kept.push(s.id);
        inQueue.add(s.id);
        budget--;
      }
    }
    queue[key] = kept;
  }
  return { queue, states: next };
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
