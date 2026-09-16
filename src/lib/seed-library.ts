import { readFileSync } from "node:fs";
import path from "node:path";
import type { FavFolder, FavItem } from "./types";
import { itemId } from "./zhihu";

export const SEED_FOLDER: FavFolder = {
  urlToken: "library",
  url: "",
  title: "我的收藏",
  description: "",
  isPublic: false,
};

const CATALOG = "data/library.json";
const EXPORT_DIR = "zhihu-我的收藏-最终导出-20260916-1420";
const BODY_LIMIT = 2000;

interface CatalogFile {
  items: CatalogRow[];
}
interface CatalogRow {
  exportId: number;
  id: string;
  contentType: FavItem["contentType"];
  url: string;
  title: string;
  summary: string;
  createdAt: number;
  favTime: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  author?: { name: string; url?: string; urlToken?: string; headline?: string } | null;
  file: string;
}

function catalogPath(): string {
  return path.join(process.cwd(), CATALOG);
}

function extractBody(md: string): string {
  let t = md;
  if (t.includes("## 正文")) t = t.split("## 正文").slice(1).join("## 正文");
  if (t.includes("## 提取说明")) t = t.split("## 提取说明")[0] ?? t;
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t.length > BODY_LIMIT ? t.slice(0, BODY_LIMIT) : t;
}

export function loadSeedItems(): FavItem[] {
  const raw = JSON.parse(readFileSync(catalogPath(), "utf8")) as CatalogFile;
  const root = path.join(process.cwd(), EXPORT_DIR);
  return (raw.items || []).map((row) => {
    const md = readFileSync(path.join(root, row.file), "utf8");
    const summary = extractBody(md) || row.summary || "";
    return {
      id: row.id || itemId(row.url),
      contentType: row.contentType || "answer",
      url: row.url,
      title: row.title,
      summary,
      createdAt: row.createdAt,
      favTime: row.favTime,
      likeCount: row.likeCount ?? 0,
      commentCount: row.commentCount ?? 0,
      favoriteCount: row.favoriteCount ?? 0,
      author: row.author?.name
        ? {
            name: row.author.name,
            url: row.author.url || "",
            urlToken: row.author.urlToken || "",
            headline: row.author.headline || "",
          }
        : undefined,
    };
  });
}

export async function getSeedFolders(
  _identity?: string,
  _oauthToken?: string,
): Promise<{ folders: FavFolder[]; stale: boolean }> {
  return { folders: [SEED_FOLDER], stale: false };
}

export async function getSeedItems(
  _identity: string,
  folderToken: string,
  _oauthToken?: string,
  _max?: number,
): Promise<{ items: FavItem[]; total: number; stale: boolean }> {
  if (folderToken && folderToken !== "library") {
    return { items: [], total: 0, stale: false };
  }
  const items = loadSeedItems();
  return { items, total: items.length, stale: false };
}
