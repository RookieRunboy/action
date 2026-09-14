import { describe, expect, test } from "bun:test";
import { commitSelection, emptyState, ensureQueue, libraryKey, parseLibrary, parseState, recordResult, selectionFor, storageKey } from "@/lib/state";
import type { ActionCard, Card, CardsResponse, FlashCard, FolderScan } from "@/lib/types";

const D = "2026-09-14";
const scan: { token: string } & FolderScan = {
  token: "697",
  title: "我的收藏",
  counts: { total: 10, action: 4, flash: 3, skip: 3 },
  scannedAt: 1,
  provider: "test",
};

function action(id: string): ActionCard {
  return {
    id, kind: "action", folderToken: "697", reason: "可做",
    source: { url: `https://z/${id}`, title: id, contentType: "answer", favTime: 1, likeCount: 1, summary: "s" },
    tags: { do: ["冥想"], train: [] }, sourceQuote: "s", action: `做 ${id}`, why: "w", replyDraft: "r",
  };
}
function flash(id: string): FlashCard {
  return {
    id, kind: "flash", folderToken: "697", reason: "值得记",
    source: { url: `https://z/${id}`, title: id, contentType: "article", favTime: 1, likeCount: 1, summary: "s" },
    tags: { do: ["阅读"], train: ["好奇"] }, sourceQuote: "s", front: "q", back: "a",
  };
}

describe("parseState / storageKey", () => {
  test("键包含 identity", () => expect(storageKey("self")).toBe("zhixing:v2:self"));
  test("入库快照键独立于进度键", () => expect(libraryKey("self")).toBe("zhixing:v2:library:self"));
  test("null、损坏 JSON、旧版本都返回空状态", () => {
    expect(parseState(null)).toEqual(emptyState());
    expect(parseState("{oops")).toEqual(emptyState());
    expect(parseState(JSON.stringify({ version: 1, done: {} }))).toEqual(emptyState());
  });
  test("往返序列化", () => {
    const s = commitSelection(emptyState(), [action("a")], new Set(["a"]), 5, scan);
    expect(parseState(JSON.stringify(s))).toEqual(s);
  });
});

describe("commitSelection", () => {
  const cards: Card[] = [action("a"), action("b"), flash("f")];
  test("勾选且无状态 → queued，写入快照与体检", () => {
    const s = commitSelection(emptyState(), cards, new Set(["a", "f"]), 5, scan);
    expect(s.states.a).toMatchObject({ status: "queued", box: 0, due: null, addedAt: 5, kind: "action" });
    expect(s.states.f.kind).toBe("flash");
    expect(s.states.b).toBeUndefined();
    expect(s.cards.a).toEqual(cards[0]);
    expect(s.cards.b).toBeUndefined();
    expect(s.folders["697"]).toEqual({ title: "我的收藏", counts: scan.counts, scannedAt: 1, provider: "test" });
    expect(s.lastFolder).toBe("697");
  });
  test("未勾选且 queued/active → dismissed，保留 history", () => {
    let s = commitSelection(emptyState(), cards, new Set(["a"]), 5, scan);
    s = ensureQueue(s, D);
    s = recordResult(s, "a", "did", D);
    s = commitSelection(s, cards, new Set(), 6, scan);
    expect(s.states.a.status).toBe("dismissed");
    expect(s.states.a.due).toBeNull();
    expect(s.states.a.history.length).toBe(1);
  });
  test("勾选且 dismissed → queued，box 归 0，history 保留，addedAt 更新", () => {
    let s = commitSelection(emptyState(), cards, new Set(["a"]), 5, scan);
    s = ensureQueue(s, D);
    s = recordResult(s, "a", "did", D);
    s = commitSelection(s, cards, new Set(), 6, scan);
    s = commitSelection(s, cards, new Set(["a"]), 7, scan);
    expect(s.states.a).toMatchObject({ status: "queued", box: 0, due: null, addedAt: 7 });
    expect(s.states.a.history.length).toBe(1);
  });
  test("勾选且已有 queued/active/internalized → 不变", () => {
    let s = commitSelection(emptyState(), cards, new Set(["a"]), 5, scan);
    s = ensureQueue(s, D);
    const before = s.states.a;
    s = commitSelection(s, cards, new Set(["a"]), 9, scan);
    expect(s.states.a).toEqual(before);
  });
  test("不修改输入", () => {
    const s0 = emptyState();
    commitSelection(s0, cards, new Set(["a"]), 5, scan);
    expect(s0.states).toEqual({});
  });
});

describe("ensureQueue / recordResult", () => {
  const cards: Card[] = [action("a"), action("b"), action("c"), action("d"), flash("f1"), flash("f2")];
  test("ensureQueue 建立当日队列并激活新卡，重复调用不变", () => {
    let s = commitSelection(emptyState(), cards, new Set(cards.map((c) => c.id)), 5, scan);
    s = ensureQueue(s, D);
    expect(s.queues[D].actions.length).toBe(2);
    expect(s.queues[D].flash.length).toBe(2);
    const again = ensureQueue(s, D);
    expect(again).toEqual(s);
  });
  test("recordResult did 追加历史；later 触发补位", () => {
    let s = commitSelection(emptyState(), cards, new Set(cards.map((c) => c.id)), 5, scan);
    s = ensureQueue(s, D);
    const [first] = s.queues[D].actions;
    s = recordResult(s, first, "did", D);
    expect(s.states[first].history).toEqual([{ date: D, result: "did" }]);
    expect(s.queues[D].actions.length).toBe(2);
    // 第二天：first 到期(间隔1)，另外两张新卡可引入，上限 3
    const D2 = "2026-09-15";
    s = ensureQueue(s, D2);
    expect(s.queues[D2].actions.length).toBe(3);
    // D2 只引入了 1 张新卡（c），新卡额度还剩 1
    const target = s.queues[D2].actions.find((id) => id !== first)!;
    s = recordResult(s, target, "later", D2);
    // later 不占上限 → 用剩余额度补进 d，队列变成 4 张（含一张「明天再来」）
    expect(s.queues[D2].actions.length).toBe(4);
    expect(s.states.d.status).toBe("active");
    expect(s.states[target].due).toBe("2026-09-16");
  });
  test("recordResult 对未知 id 返回原状态", () => {
    const s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a"]), 5, scan), D);
    expect(recordResult(s, "nope", "did", D)).toEqual(s);
  });
});

describe("selectionFor", () => {
  test("无状态、queued、active、internalized 勾选；dismissed 不勾", () => {
    const cards: Card[] = [action("a"), action("b"), action("c")];
    let s = commitSelection(emptyState(), cards, new Set(["a", "b"]), 5, scan);
    s = commitSelection(s, cards, new Set(["a"]), 6, scan); // b → dismissed
    expect([...selectionFor(s, cards)].sort()).toEqual(["a", "c"]);
  });
});

describe("parseLibrary", () => {
  const lib: CardsResponse = {
    folder: { urlToken: "library", title: "收藏" },
    counts: { total: 2, action: 1, flash: 1, skip: 0 },
    cards: [action("a"), flash("f")],
    skipped: [],
    provider: "test",
    stale: false,
  };
  test("合法快照往返", () => {
    expect(parseLibrary(JSON.stringify(lib))).toEqual(lib);
  });
  test("损坏或缺少 cards 视为没有快照", () => {
    expect(parseLibrary(null)).toBeNull();
    expect(parseLibrary("{oops")).toBeNull();
    expect(parseLibrary(JSON.stringify({ folder: {}, cards: null }))).toBeNull();
  });
});
