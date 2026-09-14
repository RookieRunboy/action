import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.join(process.cwd(), ".cache");

export function hashKey(...parts: (string | number)[]): string {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);
}

function fileFor(ns: string, key: string) {
  return path.join(ROOT, ns, `${key}.json`);
}

interface Envelope<T> {
  savedAt: number;
  value: T;
}

export async function cacheGet<T>(ns: string, key: string, ttlMs = Infinity): Promise<T | null> {
  try {
    const raw = await fs.readFile(fileFor(ns, key), "utf8");
    const env = JSON.parse(raw) as Envelope<T>;
    if (Date.now() - env.savedAt > ttlMs) return null;
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

export async function cached<T>(ns: string, key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(ns, key, ttlMs);
  if (hit !== null) return hit;
  const value = await fn();
  await cacheSet(ns, key, value);
  return value;
}
