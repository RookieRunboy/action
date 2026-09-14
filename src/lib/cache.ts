import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { tmpdir } from "node:os";

export function cacheRoot(): string {
  if (process.env.ZHIXING_CACHE_DIR) return process.env.ZHIXING_CACHE_DIR;
  // Vercel 的 cwd（/var/task）只读，只能写 /tmp
  if (process.env.VERCEL) return path.join(tmpdir(), "zhixing-cache");
  return path.join(process.cwd(), ".cache");
}

function fileFor(ns: string, key: string) {
  return path.join(cacheRoot(), ns, `${key}.json`);
}

export function hashKey(...parts: (string | number)[]): string {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);
}

interface Envelope<T> {
  savedAt: number;
  value: T;
}

export async function cacheGet<T>(ns: string, key: string, ttlMs = Infinity): Promise<T | null> {
  try {
    const raw = await fs.readFile(fileFor(ns, key), "utf8");
    const env = JSON.parse(raw) as Envelope<T>;
    if (Date.now() - env.savedAt >= ttlMs) return null;
    return env.value;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(ns: string, key: string, value: T): Promise<void> {
  const file = fileFor(ns, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const env: Envelope<T> = { savedAt: Date.now(), value };
  await fs.writeFile(file, JSON.stringify(env), "utf8");
}

async function cacheSetBestEffort<T>(ns: string, key: string, value: T): Promise<void> {
  try {
    await cacheSet(ns, key, value);
  } catch {
    // 缓存写失败不影响本次结果（例如只读文件系统）
  }
}

export async function cached<T>(ns: string, key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(ns, key, ttlMs);
  if (hit !== null) return hit;
  const value = await fn();
  await cacheSetBestEffort(ns, key, value);
  return value;
}

/**
 * 带快照回退的缓存：命中且未过期直接返回；过期则重拉，重拉失败时回退旧快照并标记 stale。
 * 快照永不删除（规范 §6）。
 */
export async function cachedWithFallback<T>(
  ns: string,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ value: T; stale: boolean }> {
  const fresh = await cacheGet<T>(ns, key, ttlMs);
  if (fresh !== null) return { value: fresh, stale: false };
  try {
    const value = await fn();
    await cacheSetBestEffort(ns, key, value);
    return { value, stale: false };
  } catch (e) {
    const old = await cacheGet<T>(ns, key);
    if (old !== null) return { value: old, stale: true };
    throw e;
  }
}
