import { describe, expect, test } from "bun:test";
import { LIBRARY_TOKEN, ingestLibrary } from "@/lib/pipeline";
import { SEED_FOLDER, loadSeedItems } from "@/lib/seed-library";
import { SORT_SYSTEM } from "@/lib/prompts";
import type { ChatFn } from "@/lib/llm";

describe("loadSeedItems", () => {
  test("读出 35 条收藏，正文来自 Markdown 而不是短摘要", () => {
    const items = loadSeedItems();
    expect(items).toHaveLength(35);
    expect(new Set(items.map((i) => i.id)).size).toBe(35);

    const habits = items.find((i) => i.title.includes("人生回报率最大的21件事"));
    expect(habits).toBeDefined();
    expect(habits!.summary).toContain("每天运动30分钟");
    expect(habits!.url).toContain("zhuanlan.zhihu.com");
    expect(habits!.author?.name).toBe("活在当下");
  });

  test("假装收藏夹就叫「我的收藏」", () => {
    expect(SEED_FOLDER.urlToken).toBe(LIBRARY_TOKEN);
    expect(SEED_FOLDER.title).toBe("我的收藏");
  });
});

describe("ingestLibrary 默认读种子收藏夹", () => {
  test("不注入 fetch 时，用 35 篇正文当分拣输入", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-seed-ingest-${Date.now()}`;
    const seen: string[] = [];
    const chat: ChatFn = async <T,>(system: string, user: string): Promise<T> => {
      if (system.includes("分拣员")) {
        seen.push(user);
        const ids = [...user.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!);
        return { items: ids.map((id) => ({ id, kind: "skip", reason: "本测只看输入" })) } as T;
      }
      throw new Error("unexpected prompt");
    };
    const res = await ingestLibrary({ identity: "seed-user", refresh: true }, { chat, provider: "假模型" });
    expect(res.folder).toEqual({ urlToken: LIBRARY_TOKEN, title: "我的收藏" });
    expect(res.counts).toEqual({ total: 35, action: 0, flash: 0, skip: 35 });
    expect(seen.join("\n")).toContain("每天运动30分钟");
  });
});

describe("分拣提示词", () => {
  test("按收藏正文摘录来分拣，不再写没有全文", () => {
    expect(SORT_SYSTEM).toContain("正文");
    expect(SORT_SYSTEM).not.toContain("没有全文");
  });
});
