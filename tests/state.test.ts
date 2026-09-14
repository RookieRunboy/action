import { describe, expect, test } from "bun:test";
import { advanceQueue, commitSelection, emptyState, ensureQueue, libraryKey, parseLibrary, parseState, recordResult, selectionFor, storageKey } from "@/lib/state";
import type { ActionCard, Card, CardsResponse, FlashCard, FolderScan, StateV2 } from "@/lib/types";

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
  test("旧 {actions, flash} 队列被忽略", () => {
    const s = parseState(JSON.stringify({
      version: 2,
      cards: {},
      states: {},
      queues: { [D]: { actions: ["a"], flash: ["f"] } },
      folders: {},
    }));
    expect(s.queues).toEqual({});
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

function markGroup(s: StateV2, date: string) {
  let next = s;
  for (const id of next.queues[date].ids) {
    const result = next.states[id].kind === "action" ? "did" as const : "remembered" as const;
    next = recordResult(next, id, result, date);
  }
  return next;
}

describe("ensureQueue / recordResult / advanceQueue", () => {
  const cards: Card[] = [action("a"), action("b"), action("c"), action("d"), flash("f1"), flash("f2")];
  test("ensureQueue 建立当日混排组并激活新卡，重复调用冻结不变", () => {
    let s = commitSelection(emptyState(), cards, new Set(cards.map((c) => c.id)), 5, scan);
    s = ensureQueue(s, D);
    expect(s.queues[D].ids).toEqual(["a", "b", "c"]);
    expect(s.states.a.status).toBe("active");
    expect(s.states.d.status).toBe("queued");
    const again = ensureQueue(s, D);
    expect(again).toEqual(s);
  });
  test("recordResult 追加历史，但不自动换组、later 也不补位", () => {
    let s = commitSelection(emptyState(), cards, new Set(cards.map((c) => c.id)), 5, scan);
    s = ensureQueue(s, D);
    const ids = s.queues[D].ids;
    s = recordResult(s, ids[0], "later", D);
    expect(s.states[ids[0]].history).toEqual([{ date: D, result: "later" }]);
    expect(s.states[ids[0]].due).toBe("2026-09-15");
    expect(s.queues[D].ids).toEqual(ids);
    expect(s.states.d.status).toBe("queued");
  });
  test("advanceQueue 未全部标记时不变", () => {
    let s = commitSelection(emptyState(), cards, new Set(cards.map((c) => c.id)), 5, scan);
    s = ensureQueue(s, D);
    s = recordResult(s, s.queues[D].ids[0], "did", D);
    const blocked = advanceQueue(s, D);
    expect(blocked.queues[D].ids).toEqual(s.queues[D].ids);
    expect(blocked.states.d.status).toBe("queued");
  });
  test("advanceQueue 全部标记后进入下一组；耗尽后为空且不绕回", () => {
    let s = commitSelection(emptyState(), cards, new Set(cards.map((c) => c.id)), 5, scan);
    s = ensureQueue(s, D);
    s = markGroup(s, D);
    s = advanceQueue(s, D);
    expect(s.queues[D].ids).toEqual(["d", "f1", "f2"]);
    expect(s.states.d.status).toBe("active");
    s = markGroup(s, D);
    s = advanceQueue(s, D);
    expect(s.queues[D].ids).toEqual([]);
    expect(advanceQueue(s, D).queues[D].ids).toEqual([]);
  });
  test("同一天可连续完成超过 3 张行动和 5 张闪卡", () => {
    const many: Card[] = [
      ...["a1", "a2", "a3", "a4"].map(action),
      ...["f1", "f2", "f3", "f4", "f5", "f6"].map(flash),
    ];
    let s = commitSelection(emptyState(), many, new Set(many.map((c) => c.id)), 5, scan);
    s = ensureQueue(s, D);
    const done = { action: 0, flash: 0 };
    let guard = 0;
    while (s.queues[D].ids.length && guard++ < 20) {
      for (const id of s.queues[D].ids) done[s.states[id].kind]++;
      s = markGroup(s, D);
      s = advanceQueue(s, D);
    }
    expect(done).toEqual({ action: 4, flash: 6 });
    expect(s.queues[D].ids).toEqual([]);
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
