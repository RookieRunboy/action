import { describe, expect, test } from "bun:test";
import { INGEST_LIMIT, ingestLibrary, LIBRARY_TOKEN, mergeRecentItems, scanFolder, toActionCards, validateQuote } from "@/lib/pipeline";
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

/** 假 LLM：一律标成 action，并给每条都造卡。生活场景过滤必须由生产代码完成。 */
function naiveAllActionChat(actionText: string): ChatFn {
  return async <T,>(system: string, user: string): Promise<T> => {
    const ids = [...user.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!);
    if (system.includes("分拣员")) {
      return { items: ids.map((id) => ({ id, kind: "action", reason: "有具体步骤" })) } as T;
    }
    if (system.includes("行动教练")) {
      return {
        items: ids.map((id) => ({
          id,
          action: actionText,
          why: "作者说可以立刻开始",
          sourceQuote: "摘要",
          replyDraft: "我照做了",
          tags: { do: ["其他"], train: [] },
        })),
      } as T;
    }
    if (system.includes("出题")) {
      return {
        items: ids.map((id) => ({
          id,
          front: "这条要记住什么？",
          back: "技术或校准要领",
          sourceQuote: "摘要",
          tags: { do: ["其他"], train: [] },
        })),
      } as T;
    }
    throw new Error("unexpected prompt");
  };
}

describe("scanFolder 生活场景", () => {
  test("naive 全标 action 时按标题摘要纠正具名路径", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-life-scene-${Date.now()}`;
    const lifeItems = [
      item("p1", "超负荷运球怎么练", "左手运球的同时右手持网球 30 秒，用超负荷刺激弱侧。"),
      item("p2", "如何调坐垫", "用吊坠法校准坐垫前后和高度，吊线对准膝前。"),
      item("p3", "脚掌发力", "原地踮脚 3 次，只抬脚掌，不要借腿跳。"),
      item("p4", "靠墙站检查体态", "靠墙站，后脑勺、肩胛、骶骨、脚跟贴墙。"),
      item("p5", "工位含胸", "坐直，交叉抱肘，向后夹肩胛，停两秒。"),
    ];
    const res = await scanFolder(
      { identity: "life", folderToken: "697", refresh: true },
      {
        chat: naiveAllActionChat("现在坐下做一次最小一步"),
        provider: "假模型",
        fetchFolders: async () => ({ folders, stale: false }),
        fetchItems: async () => ({ items: lifeItems, total: lifeItems.length, stale: false }),
      },
    );

    const card = (title: string) => res.cards.find((c) => c.source.title === title);
    const skipped = (title: string) => res.skipped.find((s) => s.title === title);

    expect(card("超负荷运球怎么练")).toBeUndefined();
    expect(skipped("超负荷运球怎么练")).toBeTruthy();

    expect(card("如何调坐垫")?.kind).toBe("flash");
    expect(res.cards.some((c) => c.kind === "action" && c.source.title === "如何调坐垫")).toBe(false);

    expect(card("脚掌发力")?.kind).toBe("action");
    expect(card("靠墙站检查体态")?.kind).toBe("action");
    expect(card("工位含胸")?.kind).toBe("action");
  });
});

describe("toActionCards 生活场景过滤", () => {
  test("行动原文不是生活微步骤则不发卡", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-action-filter-${Date.now()}`;
    const it = item("a1", "工位拉伸", "坐着也能活动肩背。");
    const chat: ChatFn = async <T,>(): Promise<T> =>
      ({
        items: [{
          id: "a1",
          action: "左手运球同时右手持网球 30 秒",
          why: "作者说要练",
          sourceQuote: "坐着也能活动肩背",
          replyDraft: "我试了",
          tags: { do: ["运动"], train: ["体能"] },
        }],
      }) as T;
    const cards = await toActionCards([it], chat, "697", new Map([["a1", "有步骤"]]));
    expect(cards).toHaveLength(0);
  });

  test("踮脚微步骤会发卡", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-action-ok-${Date.now()}`;
    const it = item("a2", "脚掌发力", "原地踮脚 3 次，只抬脚掌。");
    const chat: ChatFn = async <T,>(): Promise<T> =>
      ({
        items: [{
          id: "a2",
          action: "原地踮脚 3 次，只抬脚掌",
          why: "作者说先抬脚掌",
          sourceQuote: "原地踮脚 3 次，只抬脚掌",
          replyDraft: "我踮了三下",
          tags: { do: ["运动"], train: ["体能"] },
        }],
      }) as T;
    const cards = await toActionCards([it], chat, "697", new Map([["a2", "能做"]]));
    expect(cards).toHaveLength(1);
    expect(cards[0]?.action).toContain("踮脚");
  });
});

describe("ingestLibrary", () => {
  test("合并各夹最近收藏，卡片保留来源夹", async () => {
    process.env.ZHIXING_CACHE_DIR = `/tmp/zx-ingest-${Date.now()}`;
    const publicFolder: FavFolder = { urlToken: "pub", url: "", title: "公开", description: "", isPublic: true };
    const privateFolder: FavFolder = { urlToken: "priv", url: "", title: "私密", description: "", isPublic: false };
    const fetched: string[] = [];
    const res = await ingestLibrary(
      { identity: "t", refresh: true },
      {
        chat,
        provider: "假模型",
        fetchFolders: async () => ({ folders: [publicFolder, privateFolder], stale: false }),
        fetchItems: async (_id, token) => {
          fetched.push(token);
          if (token === "priv") return { items: [item("i1", "私密里的同条", "s", 9_000_000_000)], total: 1, stale: false };
          return { items, total: items.length, stale: false };
        },
      },
    );
    expect(fetched).toEqual(["pub", "priv"]);
    expect(res.folder).toEqual({ urlToken: LIBRARY_TOKEN, title: "收藏" });
    expect(res.cards.find((c) => c.kind === "action")?.folderToken).toBe("priv");
    expect(res.counts.total).toBe(4);
  });
});
