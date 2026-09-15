import type { Card, CardState, Result } from "./types";
import { addDays } from "./dates";
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

function getLevel(count: number, inFuture: boolean): 0 | 1 | 2 | 3 | 4 {
  if (inFuture || count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
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
  let filteredEffectiveRecords = 0;
  const actionCounts = { did: 0, later: 0 };
  const flashCounts = { remembered: 0, vague: 0, forgot: 0 };

  // 按日期聚合当前 filter 下的打卡次数 (later 不计)
  const dateEffectiveCount: Record<string, number> = {};

  // 标签统计：记录卡片是否已被计算过（独立卡片数）
  const doTagMap: Record<string, number> = {};
  const trainTagMap: Record<string, number> = {};

  for (const st of allStates) {
    const card = cards[st.id];
    let cardHasEffectiveForTags = false;

    for (const h of st.history) {
      const eff = isEffective(h.result);
      if (eff) {
        totalEffectiveRecords++;
      }

      const matchesFilter = filter === "all" || st.kind === filter;
      if (matchesFilter && eff) {
        filteredEffectiveRecords++;
        dateEffectiveCount[h.date] = (dateEffectiveCount[h.date] || 0) + 1;
        cardHasEffectiveForTags = true;
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

    if (cardHasEffectiveForTags && card?.tags) {
      const uniqueDo = new Set(card.tags.do.filter(Boolean));
      for (const t of uniqueDo) {
        doTagMap[t] = (doTagMap[t] || 0) + 1;
      }
      const uniqueTrain = new Set(card.tags.train.filter(Boolean));
      for (const t of uniqueTrain) {
        trainTagMap[t] = (trainTagMap[t] || 0) + 1;
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

  // 标签排序：降序 count，其次升序字典序
  const sortTags = (map: Record<string, number>): TagStat[] =>
    Object.entries(map)
      .filter(([, count]) => count > 0)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const tags: ReviewTags = {
    do: sortTags(doTagMap),
    train: sortTags(trainTagMap),
  };

  // 16 周热力日历计算
  const todayDate = new Date(today + "T00:00:00");
  const dayOfWeek = todayDate.getDay(); // 0 是周日
  const currentWeekSunday = addDays(today, -dayOfWeek);
  const currentWeekSaturday = addDays(today, 6 - dayOfWeek);
  const startDate = addDays(currentWeekSunday, -15 * 7);
  const endDate = currentWeekSaturday;

  const weeks: CalendarWeek[] = [];
  let calendarTotalRecords = 0;

  for (let w = 0; w < 16; w++) {
    const days: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = addDays(startDate, w * 7 + d);
      const isToday = dateStr === today;
      const inFuture = dateStr > today;
      const count = inFuture ? 0 : dateEffectiveCount[dateStr] || 0;
      calendarTotalRecords += count;

      days.push({
        date: dateStr,
        count,
        level: getLevel(count, inFuture),
        isToday,
        inFuture,
      });
    }
    weeks.push({ days });
  }

  return {
    filter,
    today,
    emptyTier,
    hasCards,
    totalEffectiveRecords,
    filteredEffectiveRecords,
    counts: {
      streakDays,
      summary,
      action: actionCounts,
      flash: flashCounts,
    },
    tags,
    calendar: {
      weeks,
      startDate,
      endDate,
      totalRecords: calendarTotalRecords,
    },
  };
}
