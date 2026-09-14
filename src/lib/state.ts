import type { Card, CardsResponse, CardState, DayQueue, FolderScan, Result, StateV2 } from "./types";
import { advanceGroup, applyResult, buildGroup, newCardState } from "./schedule";

export function emptyState(): StateV2 {
  return { version: 2, cards: {}, states: {}, queues: {}, folders: {} };
}

export function storageKey(identity: string): string {
  return `zhixing:v2:${identity}`;
}

export function libraryKey(identity: string): string {
  return `zhixing:v2:library:${identity}`;
}

export function parseLibrary(raw: string | null): CardsResponse | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<CardsResponse>;
    if (!p || !Array.isArray(p.cards) || !p.folder || !p.counts) return null;
    return {
      folder: p.folder,
      counts: p.counts,
      cards: p.cards,
      skipped: Array.isArray(p.skipped) ? p.skipped : [],
      provider: typeof p.provider === "string" ? p.provider : "",
      stale: !!p.stale,
    };
  } catch {
    return null;
  }
}

export function loadLibrary(identity: string): CardsResponse | null {
  try {
    return parseLibrary(globalThis.localStorage?.getItem(libraryKey(identity)) ?? null);
  } catch {
    return null;
  }
}

export function saveLibrary(identity: string, data: CardsResponse): boolean {
  try {
    globalThis.localStorage?.setItem(libraryKey(identity), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function parseQueue(raw: unknown): DayQueue | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const ids = (raw as { ids?: unknown }).ids;
  if (!Array.isArray(ids)) return undefined;
  return { ids: ids.filter((id): id is string => typeof id === "string") };
}

function parseQueues(raw: unknown): Record<string, DayQueue> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, DayQueue> = {};
  for (const [date, q] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseQueue(q);
    if (parsed) out[date] = parsed;
  }
  return out;
}

export function parseState(raw: string | null): StateV2 {
  if (!raw) return emptyState();
  try {
    const p = JSON.parse(raw) as Partial<StateV2>;
    if (p?.version !== 2 || typeof p.cards !== "object" || typeof p.states !== "object") return emptyState();
    return {
      version: 2,
      cards: p.cards || {},
      states: p.states || {},
      queues: parseQueues(p.queues),
      folders: p.folders || {},
      lastFolder: p.lastFolder,
    };
  } catch {
    return emptyState();
  }
}

export function loadState(identity: string): StateV2 {
  try {
    return parseState(globalThis.localStorage?.getItem(storageKey(identity)) ?? null);
  } catch {
    return emptyState();
  }
}

/** 返回是否写入成功；失败（私密模式、配额）时调用方可提示「本浏览器无法保存进度」 */
export function saveState(identity: string, s: StateV2): boolean {
  try {
    globalThis.localStorage?.setItem(storageKey(identity), JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** 规范 §8.2「加入知行」的状态转换 */
export function commitSelection(
  s: StateV2,
  cards: Card[],
  selectedIds: Set<string>,
  now: number,
  scan: { token: string } & FolderScan,
): StateV2 {
  const states: Record<string, CardState> = { ...s.states };
  const snapshots: Record<string, Card> = { ...s.cards };
  for (const card of cards) {
    const cur = states[card.id];
    const selected = selectedIds.has(card.id);
    if (selected) {
      if (!cur) {
        states[card.id] = newCardState(card.id, card.kind, now);
        snapshots[card.id] = card;
      } else if (cur.status === "dismissed") {
        states[card.id] = { ...cur, status: "queued", box: 0, due: null, introducedAt: null, addedAt: now };
        snapshots[card.id] = card;
      }
    } else if (cur && (cur.status === "queued" || cur.status === "active")) {
      states[card.id] = { ...cur, status: "dismissed", due: null };
    }
  }
  const { token, ...folderScan } = scan;
  return { ...s, cards: snapshots, states, folders: { ...s.folders, [token]: folderScan }, lastFolder: token };
}

function withQueue(s: StateV2, date: string, queue: DayQueue, states: Record<string, CardState>): StateV2 {
  const existing = s.queues[date];
  const unchanged =
    existing !== undefined &&
    JSON.stringify(existing) === JSON.stringify(queue) &&
    JSON.stringify(states) === JSON.stringify(s.states);
  if (unchanged) return s;
  return { ...s, states, queues: { ...s.queues, [date]: queue } };
}

/** 保证 queues[date] 存在；已有则冻结，没有则建第一组。纯函数 */
export function ensureQueue(s: StateV2, date: string): StateV2 {
  const { queue, states } = buildGroup(s.states, date, s.queues[date]);
  return withQueue(s, date, queue, states);
}

/** 组内全部有结果后换下一组；未完成则不变。 */
export function advanceQueue(s: StateV2, date: string): StateV2 {
  const existing = s.queues[date] ?? { ids: [] };
  const { queue, states } = advanceGroup(s.states, date, existing);
  return withQueue(s, date, queue, states);
}

export function recordResult(s: StateV2, id: string, result: Result, date: string): StateV2 {
  const cur = s.states[id];
  if (!cur) return s;
  const updated = applyResult(cur, result, date);
  if (updated === cur) return s;
  return { ...s, states: { ...s.states, [id]: updated } };
}

/** 筹划页默认勾选集（规范 §8.2） */
export function selectionFor(s: StateV2, cards: Card[]): Set<string> {
  const out = new Set<string>();
  for (const c of cards) {
    const st = s.states[c.id];
    if (!st || st.status !== "dismissed") out.add(c.id);
  }
  return out;
}
