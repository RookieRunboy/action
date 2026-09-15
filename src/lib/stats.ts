import type { Card, CardState, Result } from "./types";
import { streak } from "./schedule";

export type StatsFilter = "all" | "action" | "flash";

export interface ReviewSummary {
  internalized: number;
  active: number;
  queued: number;
}

export interface ReviewCounts {
  streakDays: number;
  summary: ReviewSummary;
  action: { did: number; later: number };
  flash: { remembered: number; vague: number; forgot: number };
}

export interface TagStat {
  tag: string;
  count: number;
}

export interface ReviewTags {
  do: TagStat[];
  train: TagStat[];
}

export interface CalendarCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  inFuture: boolean;
}

export interface CalendarWeek {
  days: CalendarCell[];
}

export interface ReviewCalendar {
  weeks: CalendarWeek[];
  startDate: string;
  endDate: string;
  totalRecords: number;
}

export type EmptyStateTier = "none" | "no_cards" | "no_records";

export interface ReviewStats {
  filter: StatsFilter;
  today: string;
  emptyTier: EmptyStateTier;
  hasCards: boolean;
  totalEffectiveRecords: number;
  filteredEffectiveRecords: number;
  counts: ReviewCounts;
  tags: ReviewTags;
  calendar: ReviewCalendar;
}

const EFFECTIVE_RESULTS: Result[] = ["did", "remembered", "vague", "forgot"];

export function isEffective(result: Result): boolean {
  return EFFECTIVE_RESULTS.includes(result);
}

export function computeStats(
  cards: Record<string, Card>,
  states: Record<string, CardState>,
  filter: StatsFilter = "all",
  today: string,
): ReviewStats {
  const allStates = Object.values(states);
  const hasCards = Object.keys(cards).length > 0 || allStates.length > 0;

  let totalEffectiveRecords = 0;
  const actionCounts = { did: 0, later: 0 };
  const flashCounts = { remembered: 0, vague: 0, forgot: 0 };

  for (const st of allStates) {
    for (const h of st.history) {
      if (isEffective(h.result)) {
        totalEffectiveRecords++;
      }
      if (st.kind === "action") {
        if (h.result === "did") actionCounts.did++;
        else if (h.result === "later") actionCounts.later++;
      } else if (st.kind === "flash") {
        if (h.result === "remembered") flashCounts.remembered++;
        else if (h.result === "vague") flashCounts.vague++;
        else if (h.result === "forgot") flashCounts.forgot++;
      }
    }
  }

  let emptyTier: EmptyStateTier = "none";
  if (!hasCards) {
    emptyTier = "no_cards";
  } else if (totalEffectiveRecords === 0) {
    emptyTier = "no_records";
  }

  // Summary 按 filter 过滤
  const summary: ReviewSummary = { internalized: 0, active: 0, queued: 0 };
  for (const st of allStates) {
    if (filter !== "all" && st.kind !== filter) continue;
    if (st.status in summary) {
      summary[st.status as keyof ReviewSummary]++;
    }
  }

  // 全局 streak，不随 filter 切断
  const streakDays = streak(states, today);

  return {
    filter,
    today,
    emptyTier,
    hasCards,
    totalEffectiveRecords,
    filteredEffectiveRecords: totalEffectiveRecords,
    counts: {
      streakDays,
      summary,
      action: actionCounts,
      flash: flashCounts,
    },
    tags: { do: [], train: [] },
    calendar: {
      weeks: [],
      startDate: today,
      endDate: today,
      totalRecords: 0,
    },
  };
}
