import { describe, expect, test } from "bun:test";
import { adoptFlash, EMPTY_LATEST, PEEK_CAP, peekKanshan, peekMe } from "@/lib/friends";
import { KANSHAN_HABITS, KANSHAN_KNOWLEDGE } from "@/lib/kanshan";
import { emptyState } from "@/lib/state";
import { newCardState } from "@/lib/schedule";
import type { ActionCard, FlashCard, StateV2 } from "@/lib/types";

function action(id: string, addedAt: number): ActionCard {
  return {
    id, kind: "action", folderToken: "697", reason: "可做",
    source: { url: `https://z/${id}`, title: id, contentType: "answer", favTime: 1, likeCount: 1, summary: "s" },
    tags: { do: ["冥想"], train: [] }, sourceQuote: "s", action: `做 ${id}`, why: "w", replyDraft: "r",
  };
}
function flash(id: string, addedAt: number): FlashCard {
  return {
    id, kind: "flash", folderToken: "697", reason: "值得记",
    source: { url: `https://z/${id}`, title: id, contentType: "article", favTime: 1, likeCount: 1, summary: "s" },
    tags: { do: ["阅读"], train: ["好奇"] }, sourceQuote: "s", front: `问 ${id}`, back: "a",
  };
}
function withActive(cards: Array<ActionCard | FlashCard>, addedAt: number): StateV2 {
  const s = emptyState();
  for (const c of cards) {
    s.cards[c.id] = c;
    s.states[c.id] = { ...newCardState(c.id, c.kind, addedAt), status: "active", due: "2026-09-15", introducedAt: "2026-09-15" };
  }
  return s;
}

describe("peekMe", () => {
  test("空状态 latest 为还没有在练的", () => {
    const p = peekMe(emptyState());
    expect(p.habits).toEqual([]);
    expect(p.knowledge).toEqual([]);
    expect(p.latest).toBe(EMPTY_LATEST);
  });

  test("只收 active，按 addedAt 再 id 排序", () => {
    const a = action("a", 2);
    const b = action("b", 1);
    const f = flash("f", 1);
    const s = emptyState();
    s.cards = { a, b, f, q: action("q", 0) };
    s.states = {
      a: { ...newCardState("a", "action", 2), status: "active", due: "d", introducedAt: "d" },
      b: { ...newCardState("b", "action", 1), status: "active", due: "d", introducedAt: "d" },
      f: { ...newCardState("f", "flash", 1), status: "active", due: "d", introducedAt: "d" },
      q: { ...newCardState("q", "action", 0), status: "queued" },
    };
    const p = peekMe(s);
    expect(p.habits.map((x) => x.id)).toEqual(["b", "a"]);
    expect(p.knowledge.map((x) => x.id)).toEqual(["f"]);
    expect(p.knowledge[0].sourceUrl).toBe("https://z/f");
    expect(p.latest).toBe("问 f");
  });

  test("queued dismissed internalized 与缺快照不出现", () => {
    const s = withActive([action("a", 1)], 1);
    s.states.a.status = "dismissed";
    s.cards.x = action("x", 1);
    s.states.x = { ...newCardState("x", "action", 1), status: "internalized" };
    s.states.ghost = { ...newCardState("ghost", "flash", 1), status: "active", due: "d", introducedAt: "d" };
    const p = peekMe(s);
    expect(p.habits).toEqual([]);
    expect(p.knowledge).toEqual([]);
  });

  test("超过 cap 截断并报 remaining", () => {
    const cards = Array.from({ length: PEEK_CAP + 2 }, (_, i) => action(`h${i}`, i));
    const s = withActive(cards, 0);
    cards.forEach((c, i) => { s.states[c.id].addedAt = i; });
    const p = peekMe(s);
    expect(p.habits).toHaveLength(PEEK_CAP);
    expect(p.remainingHabits).toBe(2);
    expect(p.remainingKnowledge).toBe(0);
  });
});

describe("peekKanshan", () => {
  test("投影写死的 3 习惯 6 闪卡", () => {
    const p = peekKanshan();
    expect(p.habits).toHaveLength(3);
    expect(p.knowledge).toHaveLength(6);
    expect(p.remainingHabits).toBe(0);
    expect(p.remainingKnowledge).toBe(0);
    expect(p.latest).toBe(KANSHAN_KNOWLEDGE[0].front);
    expect(p.habits[0].text).toBe(KANSHAN_HABITS[0].action);
    expect(p.knowledge[0].sourceUrl).toBe(KANSHAN_KNOWLEDGE[0].source.url);
  });
});

describe("adoptFlash", () => {
  const card = KANSHAN_KNOWLEDGE[0];

  test("新卡写入 queued", () => {
    const { state, outcome } = adoptFlash(emptyState(), card, 9);
    expect(outcome).toBe("added");
    expect(state.cards[card.id]).toEqual(card);
    expect(state.states[card.id]).toMatchObject({ status: "queued", kind: "flash", addedAt: 9, box: 0, due: null });
  });

  test("已在 queued/active/internalized 不动", () => {
    let s = adoptFlash(emptyState(), card, 9).state;
    const again = adoptFlash(s, card, 10);
    expect(again.outcome).toBe("already");
    expect(again.state.states[card.id].addedAt).toBe(9);
    s = { ...s, states: { ...s.states, [card.id]: { ...s.states[card.id], status: "active" } } };
    expect(adoptFlash(s, card, 11).outcome).toBe("already");
    s = { ...s, states: { ...s.states, [card.id]: { ...s.states[card.id], status: "internalized" } } };
    expect(adoptFlash(s, card, 12).outcome).toBe("already");
  });

  test("dismissed 再加入 queued，保留 history", () => {
    let s = adoptFlash(emptyState(), card, 9).state;
    s = {
      ...s,
      states: {
        ...s.states,
        [card.id]: { ...s.states[card.id], status: "dismissed", history: [{ date: "2026-09-01", result: "forgot" }] },
      },
    };
    const { state, outcome } = adoptFlash(s, card, 13);
    expect(outcome).toBe("requeued");
    expect(state.states[card.id]).toMatchObject({ status: "queued", box: 0, due: null, addedAt: 13, introducedAt: null });
    expect(state.states[card.id].history).toHaveLength(1);
  });
});
