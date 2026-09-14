import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { cacheRoot } from "@/lib/cache";

let dir: string;
const prevVercel = process.env.VERCEL;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "zx-cache-"));
  process.env.ZHIXING_CACHE_DIR = dir;
  delete process.env.VERCEL;
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.ZHIXING_CACHE_DIR;
  if (prevVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = prevVercel;
});

describe("cachedWithFallback", () => {
  test("首次调用执行 fn 并写入；第二次命中不再调用", async () => {
    const { cachedWithFallback } = await import("@/lib/cache");
    let calls = 0;
    const fn = async () => ({ n: ++calls });
    const a = await cachedWithFallback("t", "k1", 60_000, fn);
    const b = await cachedWithFallback("t", "k1", 60_000, fn);
    expect(a).toEqual({ value: { n: 1 }, stale: false });
    expect(b).toEqual({ value: { n: 1 }, stale: false });
    expect(calls).toBe(1);
  });
  test("过期后重拉成功 → 新值、stale=false", async () => {
    const { cachedWithFallback } = await import("@/lib/cache");
    let calls = 0;
    const fn = async () => ({ n: ++calls });
    await cachedWithFallback("t", "k2", 0, fn);
    const r = await cachedWithFallback("t", "k2", 0, fn);
    expect(r).toEqual({ value: { n: 2 }, stale: false });
  });
  test("过期后重拉失败 → 回退旧快照、stale=true", async () => {
    const { cachedWithFallback } = await import("@/lib/cache");
    await cachedWithFallback("t", "k3", 0, async () => "old");
    const r = await cachedWithFallback<string>("t", "k3", 0, async () => {
      throw new Error("quota");
    });
    expect(r).toEqual({ value: "old", stale: true });
  });
  test("无快照且失败 → 抛出原错误", async () => {
    const { cachedWithFallback } = await import("@/lib/cache");
    await expect(
      cachedWithFallback("t", "k4", 1000, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
  test("缓存目录不可写时，仍返回刚拉到的值，不把 mkdir 错误抛给用户", async () => {
    const blocker = path.join(dir, "not-a-dir");
    writeFileSync(blocker, "x");
    process.env.ZHIXING_CACHE_DIR = path.join(blocker, "nested");
    const { cachedWithFallback } = await import("@/lib/cache");
    const r = await cachedWithFallback("t", "k5", 1000, async () => ({ n: 7 }));
    expect(r).toEqual({ value: { n: 7 }, stale: false });
  });
});

describe("cacheRoot", () => {
  test("显式 ZHIXING_CACHE_DIR 优先", () => {
    expect(cacheRoot()).toBe(dir);
  });
  test("Vercel 上默认写到系统临时目录，而不是 cwd/.cache", () => {
    delete process.env.ZHIXING_CACHE_DIR;
    process.env.VERCEL = "1";
    const root = cacheRoot();
    expect(root.startsWith(tmpdir())).toBe(true);
    expect(root.includes(".cache")).toBe(false);
  });
});
