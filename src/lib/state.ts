import type { Card, CardsResponse, CardState, FolderScan, Result, StateV2 } from "./types";
import { applyResult, buildQueue, newCardState } from "./schedule";

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

export function parseState(raw: string | null): StateV2 {
  if (!raw) return emptyState();
  try {
    const p = JSON.parse(raw) as Partial<StateV2>;
    if (p?.version !== 2 || typeof p.cards !== "object" || typeof p.states !== "object") return emptyState();
    return {
      version: 2,
      cards: p.cards || {},
      states: p.states || {},
      queues: p.queues || {},
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

/** 保证 queues[date] 存在并已补位；纯函数 */
export function ensureQueue(s: StateV2, date: string): StateV2 {
  const existing = s.queues[date];
  const { queue, states } = buildQueue(s.states, date, existing);
  const unchanged =
    existing !== undefined &&
    JSON.stringify(existing) === JSON.stringify(queue) &&
    JSON.stringify(states) === JSON.stringify(s.states);
  if (unchanged) return s;
  return { ...s, states, queues: { ...s.queues, [date]: queue } };
}

export function recordResult(s: StateV2, id: string, result: Result, date: string): StateV2 {
  const cur = s.states[id];
  if (!cur) return s;
  const updated = applyResult(cur, result, date);
  if (updated === cur) return s;
  const next: StateV2 = { ...s, states: { ...s.states, [id]: updated } };
  return result === "later" ? ensureQueue(next, date) : next;
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
