import type { ActionCard, Card, CardsResponse, FavItem, FlashCard, SkippedItem } from "./types";
import { cacheGet, cacheSet, hashKey } from "./cache";
import { chatJSON, providerLabel, type ChatFn } from "./llm";
import { getFavlistItems, getFavlists } from "./zhihu";
import { ACTION_SYSTEM, FLASH_SYSTEM, SORT_SYSTEM, applyLifeScenePolicy } from "./prompts";
import { normalizeTags } from "./tags";

const DAY = 24 * 60 * 60 * 1000;
const SORT_BATCH = 24;
const CONVERT_BATCH = 12;
const LIMITS = { action: 40, why: 60, replyDraft: 90, front: 40, back: 80, reason: 30, sourceQuote: 60 };
export const INGEST_LIMIT = 80;
const PER_FOLDER = 50;
export const LIBRARY_TOKEN = "library";

export interface ItemBatch {
  folderToken: string;
  items: FavItem[];
  stale?: boolean;
}

/** 跨收藏夹按收藏时间倒序去重，截到 limit。 */
export function mergeRecentItems(batches: ItemBatch[], limit = INGEST_LIMIT): (FavItem & { folderToken: string })[] {
  const byId = new Map<string, FavItem & { folderToken: string }>();
  for (const { folderToken, items } of batches) {
    for (const item of items) {
      const cur = byId.get(item.id);
      if (!cur || item.favTime > cur.favTime) byId.set(item.id, { ...item, folderToken });
    }
  }
  return [...byId.values()].sort((a, b) => b.favTime - a.favTime || b.createdAt - a.createdAt).slice(0, limit);
}

export interface ScanInput {
  identity: string;
  folderToken: string;
  oauthToken?: string;
  refresh?: boolean;
}
export interface ScanDeps {
  chat?: ChatFn;
  fetchFolders?: typeof getFavlists;
  fetchItems?: typeof getFavlistItems;
  provider?: string;
  now?: () => number;
}

function clip(s: unknown, n: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  return t.length > n ? t.slice(0, n) : t;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function describeItem(it: FavItem): string {
  const author = it.author?.name || "匿名";
  return `[${it.id}] ${it.title}｜${author}｜赞 ${it.likeCount}｜摘要：${clip(it.summary, 300) || "（无摘要）"}`;
}

// ───────── 分拣 ─────────

type SortKind = "action" | "knowledge" | "skip";
interface SortRow { id: string; kind: SortKind; reason: string }

function normalizeKind(k: unknown): SortKind {
  const s = String(k || "").toLowerCase();
  if (s.startsWith("action")) return "action";
  if (s.startsWith("know")) return "knowledge";
  return "skip";
}

function applySortPolicy(items: FavItem[], rows: SortRow[]): SortRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows.map((r) => {
    const it = byId.get(r.id);
    if (!it) return r;
    return { ...r, kind: applyLifeScenePolicy({ kind: r.kind, title: it.title, summary: it.summary }) };
  });
}

/** 返回 id → 分拣结果；AI 漏掉的条目不在结果中。24 小时缓存。 */
export async function sortItems(items: FavItem[], chat: ChatFn, opts: { identity: string; refresh?: boolean }): Promise<Map<string, SortRow>> {
  const key = hashKey("sort-v2", opts.identity, ...items.map((i) => i.id));
  if (!opts.refresh) {
    const hit = await cacheGet<SortRow[]>("sort", key, DAY);
    if (hit) return new Map(applySortPolicy(items, hit).map((r) => [r.id, r]));
  }
  const batches = await Promise.all(
    chunk(items, SORT_BATCH).map((b) => chat<{ items?: Partial<SortRow>[] }>(SORT_SYSTEM, b.map(describeItem).join("\n"), { temperature: 0.2, maxTokens: 4000 })),
  );
  const rows: SortRow[] = [];
  const ids = new Set(items.map((i) => i.id));
  for (const out of batches) {
    for (const r of out.items || []) {
      if (!r?.id || !ids.has(r.id)) continue;
      rows.push({ id: r.id, kind: normalizeKind(r.kind), reason: clip(r.reason, LIMITS.reason) || "没有说明" });
    }
  }
  const adjusted = applySortPolicy(items, rows);
  await cacheSet("sort", key, adjusted);
  return new Map(adjusted.map((r) => [r.id, r]));
}

// ───────── 引句校验 ─────────

const PUNCT = /[\s，。！？、；：“”‘’"'（）()【】\[\]…—\-·,.!?;:]/g;

function firstSentence(summary: string): string {
  const clean = summary.replace(/\[图片\]/g, "").trim();
  const m = clean.match(/^[^。！？!?]{2,}[。！？!?]?/);
  return clip(m ? m[0] : clean, LIMITS.sourceQuote);
}

/** 引句必须是摘要原文（忽略标点空白）；否则退回摘要第一句 */
export function validateQuote(summary: string, quote: unknown): string {
  const q = clip(quote, LIMITS.sourceQuote);
  const norm = (s: string) => s.replace(PUNCT, "");
  if (q && norm(q).length >= 4 && norm(summary).includes(norm(q))) return q;
  return firstSentence(summary);
}

// ───────── 转化 ─────────

function toSource(it: FavItem & { folderToken?: string }, folderToken: string) {
  return {
    folderToken: it.folderToken || folderToken,
    source: {
      url: it.url,
      title: it.title,
      contentType: it.contentType,
      favTime: it.favTime,
      likeCount: it.likeCount,
      summary: it.summary,
      author: it.author?.name ? { name: it.author.name, url: it.author.url } : undefined,
    },
  };
}

interface RawAction { id: string; action?: unknown; why?: unknown; sourceQuote?: unknown; replyDraft?: unknown; tags?: unknown }
interface RawFlash { id: string; front?: unknown; back?: unknown; sourceQuote?: unknown; tags?: unknown }

async function convert<TRaw extends { id: string }, TCard extends Card>(
  ns: string,
  system: string,
  items: FavItem[],
  chat: ChatFn,
  build: (it: FavItem, raw: TRaw) => TCard | null,
): Promise<TCard[]> {
  const result = new Map<string, TCard>();
  const missing: FavItem[] = [];
  for (const it of items) {
    const hit = await cacheGet<TCard>(ns, it.id);
    if (hit) result.set(it.id, hit);
    else missing.push(it);
  }
  const batches = await Promise.all(
    chunk(missing, CONVERT_BATCH).map((b) => chat<{ items?: TRaw[] }>(system, b.map(describeItem).join("\n"), { temperature: 0.5, maxTokens: 3500 })),
  );
  const byId = new Map<string, TRaw>();
  for (const out of batches) for (const r of out.items || []) if (r?.id) byId.set(r.id, r);
  for (const it of missing) {
    const raw = byId.get(it.id);
    const card = raw ? build(it, raw) : null;
    if (!card) continue;
    await cacheSet(ns, it.id, card);
    result.set(it.id, card);
  }
  return items.map((it) => result.get(it.id)).filter((c): c is TCard => !!c);
}

export async function toActionCards(items: FavItem[], chat: ChatFn, folderToken: string, reasons: Map<string, string>): Promise<ActionCard[]> {
  const cards = await convert<RawAction, ActionCard>("convert-a", ACTION_SYSTEM, items, chat, (it, raw) => {
    const action = clip(raw.action, LIMITS.action);
    if (!action) return null;
    if (applyLifeScenePolicy({ kind: "action", title: it.title, summary: it.summary, action }) !== "action") return null;
    return {
      id: it.id,
      kind: "action",
      ...toSource(it, folderToken),
      action,
      why: clip(raw.why, LIMITS.why),
      replyDraft: clip(raw.replyDraft, LIMITS.replyDraft),
      sourceQuote: validateQuote(it.summary, raw.sourceQuote),
      tags: normalizeTags(raw.tags),
      reason: reasons.get(it.id) || "",
    };
  });
  return cards.filter(
    (c) => applyLifeScenePolicy({ kind: "action", title: c.source.title, summary: c.source.summary, action: c.action }) === "action",
  );
}

export function toFlashCards(items: FavItem[], chat: ChatFn, folderToken: string, reasons: Map<string, string>): Promise<FlashCard[]> {
  return convert<RawFlash, FlashCard>("convert-f", FLASH_SYSTEM, items, chat, (it, raw) => {
    const front = clip(raw.front, LIMITS.front);
    const back = clip(raw.back, LIMITS.back);
    if (!front || !back) return null;
    return {
      id: it.id,
      kind: "flash",
      ...toSource(it, folderToken),
      front,
      back,
      sourceQuote: validateQuote(it.summary, raw.sourceQuote),
      tags: normalizeTags(raw.tags),
      reason: reasons.get(it.id) || "",
    };
  });
}

// ───────── 入口 ─────────

export async function scanFolder(input: ScanInput, deps: ScanDeps = {}): Promise<CardsResponse> {
  const chat = deps.chat ?? (chatJSON as ChatFn);
  const fetchFolders = deps.fetchFolders ?? getFavlists;
  const fetchItems = deps.fetchItems ?? getFavlistItems;
  const { identity, folderToken, oauthToken, refresh } = input;

  const [{ folders, stale: s1 }, { items, stale: s2 }] = await Promise.all([
    fetchFolders(identity, oauthToken),
    fetchItems(identity, folderToken, oauthToken, 100),
  ]);
  const folder = folders.find((f) => f.urlToken === folderToken);
  const title = folder?.title || "收藏夹";

  const sorted = items.length ? await sortItems(items, chat, { identity, refresh }) : new Map<string, SortRow>();
  const reasons = new Map([...sorted].map(([id, r]) => [id, r.reason]));
  const actionItems = items.filter((i) => sorted.get(i.id)?.kind === "action");
  const flashItems = items.filter((i) => sorted.get(i.id)?.kind === "knowledge");
  const skipped: SkippedItem[] = items
    .filter((i) => sorted.get(i.id)?.kind === "skip")
    .map((i) => ({ id: i.id, title: i.title, url: i.url, reason: reasons.get(i.id) || "" }));

  const [actions, flashes] = await Promise.all([
    actionItems.length ? toActionCards(actionItems, chat, folderToken, reasons) : Promise.resolve([]),
    flashItems.length ? toFlashCards(flashItems, chat, folderToken, reasons) : Promise.resolve([]),
  ]);
  const cards: Card[] = [...actions, ...flashes];

  return {
    folder: { urlToken: folderToken, title },
    counts: { total: items.length, action: actions.length, flash: flashes.length, skip: skipped.length },
    cards,
    skipped,
    provider: deps.provider ?? providerLabel(),
    stale: s1 || s2,
  };
}

export async function ingestLibrary(
  input: { identity: string; oauthToken?: string; refresh?: boolean },
  deps: ScanDeps = {},
): Promise<CardsResponse> {
  const chat = deps.chat ?? (chatJSON as ChatFn);
  const fetchFolders = deps.fetchFolders ?? getFavlists;
  const fetchItems = deps.fetchItems ?? getFavlistItems;
  const { folders, stale: s1 } = await fetchFolders(input.identity, input.oauthToken);
  const batches: ItemBatch[] = await Promise.all(
    folders.map(async (f) => {
      const { items, stale } = await fetchItems(input.identity, f.urlToken, input.oauthToken, PER_FOLDER);
      return { folderToken: f.urlToken, items, stale };
    }),
  );
  const items = mergeRecentItems(batches);
  const stale = s1 || batches.some((b) => b.stale);

  const sorted = items.length ? await sortItems(items, chat, { identity: input.identity, refresh: input.refresh }) : new Map<string, SortRow>();
  const reasons = new Map([...sorted].map(([id, r]) => [id, r.reason]));
  const actionItems = items.filter((i) => sorted.get(i.id)?.kind === "action");
  const flashItems = items.filter((i) => sorted.get(i.id)?.kind === "knowledge");
  const skipped: SkippedItem[] = items
    .filter((i) => sorted.get(i.id)?.kind === "skip")
    .map((i) => ({ id: i.id, title: i.title, url: i.url, reason: reasons.get(i.id) || "" }));

  const [actions, flashes] = await Promise.all([
    actionItems.length ? toActionCards(actionItems, chat, LIBRARY_TOKEN, reasons) : Promise.resolve([]),
    flashItems.length ? toFlashCards(flashItems, chat, LIBRARY_TOKEN, reasons) : Promise.resolve([]),
  ]);

  return {
    folder: { urlToken: LIBRARY_TOKEN, title: "收藏" },
    counts: { total: items.length, action: actions.length, flash: flashes.length, skip: skipped.length },
    cards: [...actions, ...flashes],
    skipped,
    provider: deps.provider ?? providerLabel(),
    stale,
  };
}
