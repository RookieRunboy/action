import type { FavFolder } from "./types";

export function pickDefaultFolder(folders: FavFolder[]): FavFolder | undefined {
  return folders.find((f) => f.title === "默认收藏夹") ?? folders.find((f) => f.title.includes("默认")) ?? folders[0];
}

/** 未选择任何有效收藏夹时，只拉默认收藏夹。 */
export function resolveIngestFolders(folders: FavFolder[], tokens?: string[] | null): FavFolder[] {
  const wanted = new Set((tokens ?? []).map((t) => t.trim()).filter(Boolean));
  const picked = folders.filter((f) => wanted.has(f.urlToken));
  if (picked.length > 0) return picked;
  const fallback = pickDefaultFolder(folders);
  return fallback ? [fallback] : [];
}
