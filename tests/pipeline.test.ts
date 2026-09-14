import { describe, expect, test } from "bun:test";
import { INGEST_LIMIT, ingestLibrary, LIBRARY_TOKEN, mapPool, mergeRecentItems, scanFolder, validateQuote } from "@/lib/pipeline";
import type { ChatFn } from "@/lib/llm";
import type { FavFolder, FavItem } from "@/lib/types";

function item(id: string, title: string, summary: string, favTime = 1_700_000_000): FavItem {
  return {
    id, title, summary, url: `https://www.zhihu.com/answer/${id}`, contentType: "answer",
    createdAt: 1, favTime, likeCount: 100, commentCount: 1, favoriteCount: 1,
    author: { name: "作者" + id, url: "https://www.zhihu.com/people/x", urlToken: "x", headline: "" },
  };
}
const items = [
  item("i1", "如何冥想", "从简到难，依次练习。每天先坐一分钟。"),
  item("i2", "人脉的本质", "结论：跪下。20 来岁最危险的是持有和阶层不匹配的价值观。"),
  item("i3", "游戏台词", "这句台词让我记住了整部游戏。"),
  item("i4", "被漏掉的", "AI 不会返回这一条。"),
];
const folders: FavFolder[] = [{ urlToken: "697", url: "", title: "我的收藏", description: "", isPublic: false }];

/** 假 LLM：按 system prompt 里的关键词分辨调用类型 */
const chat: ChatFn = async <T,>(system: string, user: string): Promise<T> => {
  if (system.includes("分拣员")) {
    return {
      items: [
        { id: "i1", kind: "action", reason: "有明确步骤" },
        { id: "i2", kind: "knowledge", reason: "认知模型，非动作" },
        { id: "i3", kind: "skip", reason: "情绪共鸣型，没有可做的动作" },
        // i4 被漏掉
      ],
    } as T;
  }
  if (system.includes("行动教练")) {
    expect(user).toContain("[i1]");
    return {
      items: [{
        id: "i1", action: "现在坐下，闭眼，数十次呼吸。这是一个超过四十个字的动作描述用于验证服务端会做长度裁剪处理的情况",
        why: "作者说要从简到难", sourceQuote: "每天先坐一分钟", replyDraft: "我照做了一分钟",
        tags: { do: ["冥想", "不存在的标签"], train: ["专注"] },
      }],
    } as T;
  }
  if (system.includes("出题")) {
    expect(user).toContain("[i2]");
    return {
      items: [{
        id: "i2", front: "作者认为 20 来岁最危险的是什么？", back: "持有和阶层不匹配的价值观",
        sourceQuote: "这句话不在摘要里", tags: { do: ["职场"], train: ["独立思考", "同理", "胆识"] },
      }],
    } as T;
  }
  throw new Error("unexpected prompt");
};

describe("validateQuote", () => {
  test("忽略标点空白做子串匹配", () => {
    expect(validateQuote("从简到难，依次练习。每天先坐一分钟。", "每天先坐一分钟")).toBe("每天先坐一分钟");
    expect(validateQuote("从简到难，依次练习。", "从简到难 依次练习")).toBe("从简到难 依次练习");
  });
  test("不匹配时退回摘要第一句", () => {
    expect(validateQuote("从简到难，依次练习。每天先坐一分钟。", "瞎编的")).toBe("从简到难，依次练习。");
  });
});

describe("mapPool", () => {
  test("同时运行不超过 limit 个任务", async () => {
    let live = 0;
    let peak = 0;
    const order: number[] = [];
    await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 15));
      live--;
      order.push(n);
      return n;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(order.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("mergeRecentItems", () => {
  test("跨收藏夹按收藏时间倒序去重，截到上限", () => {
    const a = item("i1", "旧", "s", 10);
    const b = item("i1", "新同 id", "s", 30);
    const c = item("i2", "中", "s", 20);
    const d = item("i3", "最新", "s", 40);
    const got = mergeRecentItems(
      [
        { folderToken: "f1", items: [a, c] },
        { folderToken: "f2", items: [b, d] },
      ],
      2,
    );
    expect(got.map((x) => x.id)).toEqual(["i3", "i1"]);
    expect(got[1]?.folderToken).toBe("f2");
    expect(got[1]?.title).toBe("新同 id");
  });
  test("默认上限是 INGEST_LIMIT", () => {
    const items = Array.from({ length: INGEST_LIMIT + 5 }, (_, i) => item(`n${i}`, "t", "s", i));
    expect(mergeRecentItems([{ folderToken: "f", items }])).toHaveLength(INGEST_LIMIT);
    expect(mergeRecentItems([{ folderToken: "f", items }])[0]?.id).toBe(`n${INGEST_LIMIT + 4}`);
  });
});

describe("scanFolder", () => {
  test("分拣 → 双路转化 → CardsResponse", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-pipeline-${Date.now()}`;
    const res = await scanFolder(
      { identity: "t", folderToken: "697", refresh: true },
      {
        chat,
        provider: "假模型",
        fetchFolders: async () => ({ folders, stale: false }),
        fetchItems: async () => ({ items, total: items.length, stale: true }),
      },
    );
    expect(res.folder).toEqual({ urlToken: "697", title: "我的收藏" });
    expect(res.provider).toBe("假模型");
    expect(res.stale).toBe(true);
    expect(res.counts).toEqual({ total: 4, action: 1, flash: 1, skip: 1 });

    const a = res.cards.find((c) => c.kind === "action")!;
    expect(a.id).toBe("i1");
    expect(a.action.length).toBeLessThanOrEqual(40);
    expect(a.tags).toEqual({ do: ["冥想"], train: ["专注"] });
    expect(a.sourceQuote).toBe("每天先坐一分钟");
    expect(a.reason).toBe("有明确步骤");
    expect(a.folderToken).toBe("697");
    expect(a.source.author).toEqual({ name: "作者i1", url: "https://www.zhihu.com/people/x" });

    const f = res.cards.find((c) => c.kind === "flash")!;
    expect(f.id).toBe("i2");
    expect(f.kind === "flash" && f.front).toBe("作者认为 20 来岁最危险的是什么？");
    expect(f.tags.train).toEqual(["独立思考", "同理"]);
    expect(f.sourceQuote).toBe("结论：跪下。"); // 回退第一句

    expect(res.skipped).toEqual([{ id: "i3", title: "游戏台词", url: "https://www.zhihu.com/answer/i3", reason: "情绪共鸣型，没有可做的动作" }]);
    // i4 被 AI 漏掉 → 视为 skip，理由固定
    expect(res.cards.some((c) => c.id === "i4")).toBe(false);
  });
});

describe("ingestLibrary", () => {
  const publicFolder: FavFolder = { urlToken: "pub", url: "", title: "默认收藏夹", description: "", isPublic: true };
  const privateFolder: FavFolder = { urlToken: "priv", url: "", title: "私密", description: "", isPublic: false };

  test("未指定收藏夹时只拉默认收藏夹", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-ingest-${Date.now()}`;
    const fetched: string[] = [];
    const res = await ingestLibrary(
      { identity: "t", refresh: true },
      {
        chat,
        provider: "假模型",
        fetchFolders: async () => ({ folders: [publicFolder, privateFolder], stale: false }),
        fetchItems: async (_id, token) => {
          fetched.push(token);
          return { items, total: items.length, stale: false };
        },
      },
    );
    expect(fetched).toEqual(["pub"]);
    expect(res.folder).toEqual({ urlToken: LIBRARY_TOKEN, title: "收藏" });
    expect(res.cards.find((c) => c.kind === "action")?.folderToken).toBe("pub");
    expect(res.counts.total).toBe(4);
  });

  test("指定多个收藏夹则按选择拉取", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-ingest-multi-${Date.now()}`;
    const fetched: string[] = [];
    await ingestLibrary(
      { identity: "t", refresh: true, folderTokens: ["priv", "pub"] },
      {
        chat,
        provider: "假模型",
        fetchFolders: async () => ({ folders: [publicFolder, privateFolder], stale: false }),
        fetchItems: async (_id, token) => {
          fetched.push(token);
          return { items: token === "priv" ? [item("i1", "x", "s", 9)] : items, total: 1, stale: false };
        },
      },
    );
    expect(fetched.sort()).toEqual(["priv", "pub"]);
  });
});
