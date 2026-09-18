import type { Card, FlashCard, StateV2 } from "./types";
import { newCardState } from "./schedule";
import { KANSHAN_HABITS, KANSHAN_KNOWLEDGE } from "./kanshan";

export const PEEK_CAP = 5;
export const EMPTY_LATEST = "还没有在练的";

export interface PeekItem {
  id: string;
  text: string;
  kind: "action" | "flash";
  sourceUrl?: string;
}

export interface FriendPeek {
  habits: PeekItem[];
  knowledge: PeekItem[];
  remainingHabits: number;
  remainingKnowledge: number;
  latest: string;
}

function asPeek(card: Card): PeekItem {
  if (card.kind === "action") return { id: card.id, text: card.action, kind: "action" };
  return { id: card.id, text: card.front, kind: "flash", sourceUrl: card.source.url };
}

function slicePeek(items: PeekItem[]): { items: PeekItem[]; remaining: number } {
  return { items: items.slice(0, PEEK_CAP), remaining: Math.max(0, items.length - PEEK_CAP) };
}

function pack(habits: PeekItem[], knowledge: PeekItem[]): FriendPeek {
  const h = slicePeek(habits);
  const k = slicePeek(knowledge);
  return {
    habits: h.items,
    knowledge: k.items,
    remainingHabits: h.remaining,
    remainingKnowledge: k.remaining,
    latest: knowledge[0]?.text ?? habits[0]?.text ?? EMPTY_LATEST,
  };
}

export function peekMe(state: StateV2): FriendPeek {
  const active = Object.values(state.states)
    .filter((s) => s.status === "active")
    .sort((a, b) => (a.addedAt !== b.addedAt ? a.addedAt - b.addedAt : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const habits: PeekItem[] = [];
  const knowledge: PeekItem[] = [];
  for (const s of active) {
    const card = state.cards[s.id];
    if (!card) continue;
    if (card.kind === "action") habits.push(asPeek(card));
    else knowledge.push(asPeek(card));
  }
  return pack(habits, knowledge);
}

export function peekKanshan(): FriendPeek {
  // Kanshan is a fixed 3+6 set; show all (design §5.3), do not apply PEEK_CAP.
  const habits = KANSHAN_HABITS.map(asPeek);
  const knowledge = KANSHAN_KNOWLEDGE.map(asPeek);
  return {
    habits,
    knowledge,
    remainingHabits: 0,
    remainingKnowledge: 0,
    latest: knowledge[0]?.text ?? habits[0]?.text ?? EMPTY_LATEST,
  };
}

export function adoptFlash(
  state: StateV2,
  card: FlashCard,
  now: number,
): { state: StateV2; outcome: "added" | "already" | "requeued" } {
  const cur = state.states[card.id];
  if (!cur) {
    return {
      state: {
        ...state,
        cards: { ...state.cards, [card.id]: card },
        states: { ...state.states, [card.id]: newCardState(card.id, "flash", now) },
      },
      outcome: "added",
    };
  }
  if (cur.status === "dismissed") {
    return {
      state: {
        ...state,
        cards: { ...state.cards, [card.id]: card },
        states: {
          ...state.states,
          [card.id]: { ...cur, status: "queued", box: 0, due: null, introducedAt: null, addedAt: now },
        },
      },
      outcome: "requeued",
    };
  }
  return { state, outcome: "already" };
}
