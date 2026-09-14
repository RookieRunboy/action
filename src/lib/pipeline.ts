import type { Conversion, FavItem, Kind, PlanCounts, PlanResponse, SortedItem, TodayAction } from "./types";
import { cacheGet, cacheSet, hashKey } from "./cache";
import { chatJSON, providerLabel } from "./llm";
import { getFavlistItems, getFavlists } from "./zhihu";
import { CONVERT_SYSTEM, SORT_SYSTEM } from "./prompts";
import { daysOnShelf } from "./dates";

const DAY = 24 * 60 * 60 * 1000;
const DOMAINS = ["健康", "学习", "效率", "职场", "理财", "人际", "表达", "心智", "技术", "生活", "其他"];

function clip(s: string, n: number) {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n) : t;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function describeItem(it: FavItem) {
  const author = it.author?.name ? it.author.name : "匿名";
  return `[${it.id}] ${it.title}｜${author}｜赞 ${it.likeCount}｜摘要：${clip(it.summary, 300) || "（无摘要）"}`;
}

interface SortRow {
  id: string;
  kind: string;
  domain: string;
  reason: string;
}

async function sortBatch(items: FavItem[]): Promise<Map<string, SortRow>> {
  const user = items.map(describeItem).join("\n");
  const out = await chatJSON<{ items: SortRow[] }>(SORT_SYSTEM, user, { temperature: 0.2, maxTokens: 4000 });
  const map = new Map<string, SortRow>();
  for (const row of out.items || []) if (row?.id) map.set(row.id, row);
  return map;
}

function normalizeKind(k: string): Kind {
  const s = (k || "").toLowerCase();
  if (s.startsWith("action")) return "action";
  if (s.startsWith("know")) return "knowledge";
  return "skip";
}

/** 对一个收藏夹做分拣（24 小时缓存） */
export async function sortItems(identity: string, items: FavItem[], refresh = false): Promise<SortedItem[]> {
  const key = hashKey("sort", identity, ...items.map((i) => i.id));
  if (!refresh) {
    const hit = await cacheGet<SortedItem[]>("sort", key, DAY);
    if (hit) return hit;
  }
  const batches = chunk(items, 24);
  const maps = await Promise.all(batches.map(sortBatch));
  const merged = new Map<string, SortRow>();
  maps.forEach((m) => m.forEach((v, k) => merged.set(k, v)));

  const sorted: SortedItem[] = items.map((it) => {
    const row = merged.get(it.id);
    const domain = row && DOMAINS.includes(row.domain) ? row.domain : "其他";
    return {
      ...it,
      kind: row ? normalizeKind(row.kind) : "skip",
      domain,
      reason: row ? clip(row.reason, 30) : "没能判断这条内容",
    };
  });
  await cacheSet("sort", key, sorted);
  return sorted;
}

function fuzzyContains(hay: string, needle: string) {
  const norm = (s: string) => s.replace(/[\s，。！？、；：“”‘’"'（）()【】\[\]…—\-·,.!?;:]/g, "");
  const h = norm(hay);
  const n = norm(needle);
  return n.length >= 4 && h.includes(n);
}

function firstSentence(s: string, n = 50) {
  const clean = s.replace(/\[图片\]/g, "").trim();
  const m = clean.match(/^[^。！？!?]{4,}[。！？!?]?/);
  return clip(m ? m[0] : clean, n);
}

/** 把若干 action 条目转成两分钟行动（按条缓存，永久） */
export async function convertItems(items: SortedItem[]): Promise<Map<string, Conversion>> {
  const result = new Map<string, Conversion>();
  const missing: SortedItem[] = [];
  for (const it of items) {
    const hit = await cacheGet<Conversion>("convert", it.id);
    if (hit) result.set(it.id, hit);
    else missing.push(it);
  }
  if (missing.length) {
    const user = missing
      .map((it) => `${describeItem(it)}｜领域：${it.domain}`)
      .join("\n");
    const out = await chatJSON<{ items: Conversion[] }>(CONVERT_SYSTEM, user, { temperature: 0.5, maxTokens: 3000 });
    const byId = new Map((out.items || []).map((c) => [c.id, c]));
    for (const it of missing) {
      const c = byId.get(it.id);
      if (!c || !c.action) continue;
      const quote = c.sourceQuote && fuzzyContains(it.summary, c.sourceQuote) ? clip(c.sourceQuote, 60) : firstSentence(it.summary);
      const conv: Conversion = {
        id: it.id,
        action: clip(c.action, 40),
        why: clip(c.why, 60),
        sourceQuote: quote,
        replyDraft: clip(c.replyDraft, 90),
      };
      await cacheSet("convert", it.id, conv);
      result.set(it.id, conv);
    }
  }
  return result;
}

function mulberry32(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** 确定性地为某一天挑出候选：加权随机 + 领域多样性 */
export function pickForDay(actions: SortedItem[], seed: string, exclude: Set<string>, count: number): SortedItem[] {
  const rand = mulberry32(seed);
  const pool = actions
    .filter((a) => !exclude.has(a.id))
    .map((a) => {
      const w = 1 + Math.log1p(Math.max(0, a.likeCount)) / 4 + Math.min(daysOnShelf(a.favTime), 400) / 400;
      return { a, key: Math.pow(rand(), 1 / w) };
    })
    .sort((x, y) => y.key - x.key)
    .map((x) => x.a);

  const picked: SortedItem[] = [];
  const seen = new Set<string>();
  for (const a of pool) {
    if (picked.length >= count) break;
    if (seen.has(a.domain)) continue;
    picked.push(a);
    seen.add(a.domain);
  }
  for (const a of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked;
}

export function countKinds(sorted: SortedItem[]): PlanCounts {
  return sorted.reduce(
    (acc, s) => {
      acc.total++;
      acc[s.kind]++;
      return acc;
    },
    { total: 0, action: 0, knowledge: 0, skip: 0 } as PlanCounts,
  );
}

export interface PlanInput {
  identity: string;
  folderToken: string;
  date: string;
  exclude: string[];
  oauthToken?: string;
  refresh?: boolean;
}

export async function buildPlan(input: PlanInput): Promise<PlanResponse> {
  const { identity, folderToken, date, oauthToken } = input;
  const folders = await getFavlists(identity, oauthToken);
  const folder = folders.find((f) => f.urlToken === folderToken);
  const { items } = await getFavlistItems(identity, folderToken, oauthToken, 100);
  const sorted = items.length ? await sortItems(identity, items, input.refresh) : [];
  const counts = countKinds(sorted);

  const actions = sorted.filter((s) => s.kind === "action");
  const exclude = new Set(input.exclude);
  const candidates = pickForDay(actions, `${identity}|${folderToken}|${date}`, exclude, 6);
  const conversions = await convertItems(candidates);

  const toToday = (s: SortedItem): TodayAction | null => {
    const c = conversions.get(s.id);
    if (!c) return null;
    return { ...s, ...c, daysOnShelf: daysOnShelf(s.favTime) };
  };
  const converted = candidates.map(toToday).filter((x): x is TodayAction => x !== null);

  return {
    date,
    folder: folder?.title || "收藏夹",
    counts,
    today: converted.slice(0, 3),
    spares: converted.slice(3),
    knowledge: sorted.filter((s) => s.kind === "knowledge"),
    skipped: sorted.filter((s) => s.kind === "skip"),
    provider: providerLabel(),
  };
}
