import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Leaf } from "@/components/Leaf";
import { buildGroup, groupComplete, todayFlags } from "@/lib/schedule";
import { advanceQueue, commitSelection, emptyState, ensureQueue, recordResult } from "@/lib/state";
import type { ActionCard, Card, CardState, FlashCard, FolderScan, Result, StateV2 } from "@/lib/types";

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
function markGroup(s: StateV2, date: string, result: Result = "did") {
  let next = s;
  for (const id of next.queues[date].ids) {
    const r: Result = next.states[id].kind === "action" ? (result === "remembered" ? "did" : result) : (result === "did" ? "remembered" : result);
    next = recordResult(next, id, r, date);
  }
  return next;
}
function leafHtml(s: StateV2, extra: Partial<Parameters<typeof Leaf>[0]> = {}) {
  const queue = s.queues[D] ?? { ids: [] };
  const flags = todayFlags(s.states, D, queue);
  const actions = queue.ids.map((id) => s.cards[id]).filter((c): c is ActionCard => !!c && c.kind === "action");
  const flashes = queue.ids.map((id) => s.cards[id]).filter((c): c is FlashCard => !!c && c.kind === "flash");
  return renderToStaticMarkup(createElement(Leaf, {
    date: D,
    actions,
    flashes,
    states: s.states,
    onResult: () => {},
    empty: createElement("p", null, "还没有加入任何卡片。"),
    groupComplete: flags.groupDone,
    onRefresh: () => {},
    completedToday: flags.completedToday,
    libraryEmpty: flags.libraryEmpty,
    ...extra,
  }));
}

describe("todayFlags", () => {
  test("库空：无 queued/active、无当日结果 → libraryEmpty，不显示刷新", () => {
    const s = emptyState();
    const flags = todayFlags(s.states, D, { ids: [] });
    expect(flags).toMatchObject({
      libraryEmpty: true,
      completedToday: false,
      showRefresh: false,
      refreshEnabled: false,
      sealed: false,
    });
  });

  test("仅 internalized 且无当日结果 → libraryEmpty（去筹划页）", () => {
    const internalized: CardState = {
      id: "a", kind: "action", status: "internalized", box: 5, due: null,
      introducedAt: "2026-08-01", addedAt: 1, history: [{ date: "2026-08-01", result: "did" }],
    };
    const flags = todayFlags({ a: internalized }, D, { ids: [] });
    expect(flags.libraryEmpty).toBe(true);
    expect(flags.completedToday).toBe(false);
  });

  test("当前组未全部标记：刷新可见但禁用", () => {
    const cards: Card[] = [action("a"), action("b"), flash("f")];
    let s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a", "b", "f"]), 5, scan), D);
    s = recordResult(s, s.queues[D].ids[0], "did", D);
    const flags = todayFlags(s.states, D, s.queues[D]);
    expect(flags.showRefresh).toBe(true);
    expect(flags.refreshEnabled).toBe(false);
    expect(groupComplete(s.states, D, s.queues[D])).toBe(false);
    expect(flags.libraryEmpty).toBe(false);
    expect(flags.completedToday).toBe(false);
  });

  test("当前组全部标记后才允许刷新", () => {
    const cards: Card[] = [action("a"), action("b"), flash("f")];
    let s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a", "b", "f"]), 5, scan), D);
    expect(todayFlags(s.states, D, s.queues[D]).refreshEnabled).toBe(false);
    s = markGroup(s, D);
    const flags = todayFlags(s.states, D, s.queues[D]);
    expect(flags.groupDone).toBe(true);
    expect(flags.refreshEnabled).toBe(true);
    expect(flags.sealed).toBe(true);
  });

  test("刷完当日：queue 空且库非空 → completedToday，刷新隐藏；再 advance 不绕回", () => {
    const cards: Card[] = [action("a"), flash("f")];
    let s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a", "f"]), 5, scan), D);
    s = markGroup(s, D);
    s = advanceQueue(s, D);
    expect(s.queues[D].ids).toEqual([]);
    const flags = todayFlags(s.states, D, s.queues[D]);
    expect(flags.libraryEmpty).toBe(false);
    expect(flags.completedToday).toBe(true);
    expect(flags.showRefresh).toBe(false);
    expect(flags.refreshEnabled).toBe(false);
    expect(flags.sealed).toBe(true);
    expect(advanceQueue(s, D).queues[D].ids).toEqual([]);
  });

  test("仅 later 刷完当日：completedToday 但不盖知行合一", () => {
    const cards: Card[] = [action("a")];
    let s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a"]), 5, scan), D);
    s = markGroup(s, D, "later");
    s = advanceQueue(s, D);
    const flags = todayFlags(s.states, D, s.queues[D]);
    expect(flags.completedToday).toBe(true);
    expect(flags.sealed).toBe(false);
  });

  test("当日结果后最后一张内化：仍是 completedToday 而非库空", () => {
    const cards: Card[] = [action("a")];
    let s = commitSelection(emptyState(), cards, new Set(["a"]), 5, scan);
    s = { ...s, states: { ...s.states, a: { ...s.states.a, status: "active", box: 5, due: D, introducedAt: D } } };
    s = ensureQueue(s, D);
    s = recordResult(s, "a", "did", D);
    s = advanceQueue(s, D);
    expect(s.states.a.status).toBe("internalized");
    const flags = todayFlags(s.states, D, s.queues[D] ?? { ids: [] });
    expect(flags.completedToday).toBe(true);
    expect(flags.libraryEmpty).toBe(false);
    expect(flags.sealed).toBe(true);
  });
});

describe("Leaf 今日组 / 空态 / 刷新", () => {
  test("库空显示筹划空态，不含今天刷完，无刷新", () => {
    const html = leafHtml(emptyState());
    expect(html).toContain("还没有加入任何卡片。");
    expect(html).not.toContain("今天刷完");
    expect(html).not.toContain("刷新");
    expect(html).toContain("忌");
  });

  test("组未完成时刷新禁用；全部标记后启用", () => {
    const cards: Card[] = [action("a"), flash("f")];
    let s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a", "f"]), 5, scan), D);
    const blocked = leafHtml(s);
    expect(blocked).toMatch(/<button[^>]*disabled[^>]*>刷新<\/button>/);
    s = markGroup(s, D);
    const ready = leafHtml(s);
    expect(ready).toContain(">刷新<");
    expect(ready).not.toMatch(/<button[^>]*disabled[^>]*>刷新<\/button>/);
  });

  test("刷完当日显示今天刷完，保留知行合一，不是库空文案，无刷新", () => {
    const cards: Card[] = [action("a"), flash("f")];
    let s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a", "f"]), 5, scan), D);
    s = markGroup(s, D);
    s = advanceQueue(s, D);
    const html = leafHtml(s);
    expect(html).toContain("今天刷完");
    expect(html).toContain("知行合一");
    expect(html).not.toContain("还没有加入任何卡片");
    expect(html).not.toContain("刷新");
    expect(html).toContain("忌");
  });

  test("组里只有闪卡时不写「今天没有到期的行动」", () => {
    const cards: Card[] = [flash("f")];
    const s = ensureQueue(commitSelection(emptyState(), cards, new Set(["f"]), 5, scan), D);
    const html = leafHtml(s);
    expect(html).toContain("记");
    expect(html).not.toContain("今天没有到期的行动");
    expect(html).not.toContain("今天没有要复习的");
    expect(html).not.toContain('aria-label="宜"');
    expect(html).toContain('aria-label="记"');
  });

  test("组里只有行动卡时不写「今天没有要复习的」", () => {
    const cards: Card[] = [action("a")];
    const s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a"]), 5, scan), D);
    const html = leafHtml(s);
    expect(html).toContain('aria-label="宜"');
    expect(html).not.toContain('aria-label="记"');
    expect(html).not.toContain("今天没有要复习的");
    expect(html).toContain("做 a");
  });

  test("混排组按 kind 拆进宜/记，刷新仍在", () => {
    const cards: Card[] = [action("a"), flash("f"), action("b")];
    const s = ensureQueue(commitSelection(emptyState(), cards, new Set(["a", "f", "b"]), 5, scan), D);
    expect(s.queues[D].ids).toHaveLength(3);
    const html = leafHtml(s);
    expect(html).toContain("做 a");
    expect(html).toContain("做 b");
    expect(html).toContain("q");
    expect(html).toContain('aria-label="宜"');
    expect(html).toContain('aria-label="记"');
    expect(html).toContain("刷新");
  });
});

describe("buildGroup 混排与 todayFlags 衔接", () => {
  test("ensureQueue 后的组大小 ≤ 3，flags 与 groupComplete 一致", () => {
    const cards: Card[] = [action("a"), action("b"), action("c"), flash("f")];
    const s = ensureQueue(commitSelection(emptyState(), cards, new Set(cards.map((c) => c.id)), 5, scan), D);
    expect(s.queues[D].ids.length).toBeLessThanOrEqual(3);
    const built = buildGroup(s.states, D, s.queues[D]);
    expect(built.queue.ids).toEqual(s.queues[D].ids);
    expect(todayFlags(s.states, D, s.queues[D]).groupDone).toBe(groupComplete(s.states, D, s.queues[D]));
  });
});
