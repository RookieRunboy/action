import type { ContentType, FavFolder, FavItem } from "./types";
import { cachedWithFallback, hashKey } from "./cache";

const BASE = "https://developer.zhihu.com";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export class ZhihuError extends Error {
  constructor(public code: number, message: string, public status?: number) {
    super(message);
    this.name = "ZhihuError";
  }
}

function accessSecret(): string {
  const s = process.env.ZHIHU_ACCESS_SECRET?.trim();
  if (!s) throw new ZhihuError(-1, "服务端未配置 ZHIHU_ACCESS_SECRET。");
  return s;
}

export function describeCode(code: number, message?: string): string {
  switch (code) {
    case 10001:
      return `知乎接口参数有误${message ? `：${message}` : "。"}`;
    case 20001:
      return "知乎鉴权失败。请检查 Access Secret，或重新登录知乎。";
    case 30001:
      return "知乎接口请求太频繁了，等几秒再试。";
    case 30002:
      return "知乎接口今日额度已用完，明天再来。";
    case 90001:
      return "知乎接口内部错误，稍后再试。";
    default:
      return message || "知乎接口出错了。";
  }
}

type Query = Record<string, string | number | undefined>;

export async function zhihuGet<T>(pathname: string, query: Query, oauthToken?: string): Promise<T> {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessSecret()}`,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
    "Content-Type": "application/json",
  };
  if (oauthToken) headers["X-OAuth-Token"] = oauthToken;

  const res = await fetch(url, { headers, cache: "no-store" });
  const text = await res.text();
  let json: { Code?: number; Message?: string; Data?: T };
  try {
    json = JSON.parse(text);
  } catch {
    throw new ZhihuError(-2, `知乎接口返回了无法解析的内容（HTTP ${res.status}）。`, res.status);
  }
  if (!res.ok || json.Code !== 0 || json.Data === undefined) {
    const code = typeof json.Code === "number" ? json.Code : res.status;
    throw new ZhihuError(code, describeCode(code, json.Message), res.status);
  }
  return json.Data;
}

interface RawFavlist {
  UrlToken: number | string;
  Url: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
}
interface RawAuthor {
  Name: string;
  UrlToken: string;
  Url: string;
  Headline: string;
}
interface RawItem {
  ContentType: string;
  Url: string;
  CreatedAt: number;
  FavTime: number;
  LikeCount: number;
  CommentCount: number;
  FavoriteCount: number;
  Title: string;
  Summary: string;
  Author?: RawAuthor;
}
interface Paging {
  IsEnd: boolean;
  NextOffset?: string;
  Totals: number;
}

export function itemId(url: string) {
  return "i" + hashKey(url).slice(0, 8);
}

function normalizeItem(raw: RawItem): FavItem {
  return {
    id: itemId(raw.Url),
    contentType: (raw.ContentType || "answer").toLowerCase() as ContentType,
    url: raw.Url,
    title: raw.Title?.trim() || "（无标题）",
    summary: (raw.Summary || "").replace(/\s+/g, " ").trim(),
    createdAt: raw.CreatedAt,
    favTime: raw.FavTime,
    likeCount: raw.LikeCount ?? 0,
    commentCount: raw.CommentCount ?? 0,
    favoriteCount: raw.FavoriteCount ?? 0,
    author: raw.Author?.Name
      ? { name: raw.Author.Name, url: raw.Author.Url, urlToken: raw.Author.UrlToken, headline: raw.Author.Headline || "" }
      : undefined,
  };
}

/** 收藏夹列表（24 小时缓存，失败回退快照） */
export async function getFavlists(identity: string, oauthToken?: string): Promise<{ folders: FavFolder[]; stale: boolean }> {
  const { value, stale } = await cachedWithFallback("zhihu", hashKey("favlists", identity), DAY, async () => {
    const data = await zhihuGet<{ Items: RawFavlist[] }>("/api/v1/user/favlists", { Limit: 50 }, oauthToken);
    return (data.Items || []).map((f) => ({
      urlToken: String(f.UrlToken),
      url: f.Url,
      title: f.Title,
      description: f.Description || "",
      isPublic: !!f.IsPublic,
    }));
  });
  return { folders: value, stale };
}

/** 指定收藏夹内容，最多 max 条（分页 50/页，24 小时缓存，失败回退快照） */
export async function getFavlistItems(
  identity: string,
  token: string,
  oauthToken?: string,
  max = 100,
): Promise<{ items: FavItem[]; total: number; stale: boolean }> {
  const { value, stale } = await cachedWithFallback("zhihu", hashKey("favitems", identity, token, max), DAY, async () => {
    const items: FavItem[] = [];
    let offset = 0;
    let total = 0;
    for (let page = 0; page < Math.ceil(max / 50); page++) {
      const data = await zhihuGet<{ Items: RawItem[]; Paging: Paging }>(
        "/api/v1/user/favlist_contents",
        { FavlistUrlToken: token, Offset: offset, Limit: 50 },
        oauthToken,
      );
      (data.Items || []).forEach((r) => items.push(normalizeItem(r)));
      total = data.Paging?.Totals ?? items.length;
      if (data.Paging?.IsEnd || !data.Paging?.NextOffset) break;
      const next = Number(data.Paging.NextOffset);
      if (!Number.isFinite(next)) break;
      offset = next;
    }
    return { items, total };
  });
  return { ...value, stale };
}
