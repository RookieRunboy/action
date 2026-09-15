# 「回顾」统计模块实施计划 (Review Stats Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建「回顾」统计模块（纯函数计算、数量统计、标签分布、16 周热力图与两档空态），集成顶部导航与鉴权路由 `/review`，并通过完整单元测试。

**Architecture:** 保持架构纯粹与轻量——只读现有客户端 `zhixing:v2:<identity>` 状态，通过纯函数 `computeStats(cards, states, filter, today)` 产生无副作用的视图模型，由细粒度 React 组件（`StatsCounts`, `StatsTags`, `StatsCalendar`）使用原生 CSS/SVG 网格在单列约 720px 纸墨布局中呈现，不引入第三方图表库。

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Bun Test.

---

### Task 1: 核心统计引擎基础：数量统计与状态摘要 (src/lib/stats.ts)

**Files:**
- Create: `src/lib/stats.ts`
- Create: `tests/stats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/stats.test.ts
import { describe, expect, test } from "bun:test";
import { computeStats } from "@/lib/stats";
import type { Card, CardState } from "@/lib/types";

describe("computeStats - 数量与状态摘要", () => {
  const mockCard = (id: string, kind: "action" | "flash", doTags: string[] = ["冥想"]): Card => ({
    id,
    folderToken: "f1",
    kind,
    source: {
      url: `https://zhihu.com/question/1/answer/${id}`,
      title: `卡片 ${id}`,
      contentType: "answer",
      favTime: 1700000000,
      likeCount: 10,
      summary: "摘要",
    },
    tags: { do: doTags, train: ["专注"] },
    sourceQuote: "摘要原文",
    reason: "分拣理由",
    ...(kind === "action"
      ? { action: "深呼吸一分钟", why: "平复情绪", replyDraft: "感谢" }
      : { front: "什么是正念？", back: "专注于当下" }),
  });

  const mockState = (
    id: string,
    kind: "action" | "flash",
    status: CardState["status"],
    history: CardState["history"] = [],
  ): CardState => ({
    id,
    kind,
    status,
    box: 1,
    due: "2026-09-15",
    introducedAt: "2026-09-10",
    addedAt: 1700000000,
    history,
  });

  test("库内无卡时返回 no_cards 空态", () => {
    const stats = computeStats({}, {}, "all", "2026-09-15");
    expect(stats.emptyTier).toBe("no_cards");
    expect(stats.hasCards).toBe(false);
    expect(stats.totalEffectiveRecords).toBe(0);
    expect(stats.counts.streakDays).toBe(0);
    expect(stats.counts.summary).toEqual({ internalized: 0, active: 0, queued: 0 });
  });

  test("有卡但无历史打卡或仅有 later 时返回 no_records 空态", () => {
    const cards = { a1: mockCard("a1", "action") };
    const states = { a1: mockState("a1", "action", "active", [{ date: "2026-09-15", result: "later" }]) };
    const stats = computeStats(cards, states, "all", "2026-09-15");
    expect(stats.emptyTier).toBe("no_records");
    expect(stats.hasCards).toBe(true);
    expect(stats.totalEffectiveRecords).toBe(0);
    expect(stats.counts.streakDays).toBe(0);
    expect(stats.counts.action.later).toBe(1);
    expect(stats.counts.action.did).toBe(0);
  });

  test("有效打卡累计次数与状态摘要（含 dismissed 历史保留）", () => {
    const cards = {
      a1: mockCard("a1", "action"),
      a2: mockCard("a2", "action"),
      f1: mockCard("f1", "flash"),
    };
    const states = {
      a1: mockState("a1", "action", "active", [
        { date: "2026-09-14", result: "did" },
        { date: "2026-09-15", result: "did" },
      ]),
      a2: mockState("a2", "action", "dismissed", [
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-14", result: "later" },
      ]),
      f1: mockState("f1", "flash", "internalized", [
        { date: "2026-09-14", result: "remembered" },
        { date: "2026-09-15", result: "vague" },
      ]),
    };

    const statsAll = computeStats(cards, states, "all", "2026-09-15");
    expect(statsAll.emptyTier).toBe("none");
    expect(statsAll.counts.action.did).toBe(3); // a1 2次 + a2 1次
    expect(statsAll.counts.action.later).toBe(1); // a2 1次
    expect(statsAll.counts.flash.remembered).toBe(1);
    expect(statsAll.counts.flash.vague).toBe(1);
    expect(statsAll.counts.flash.forgot).toBe(0);
    expect(statsAll.counts.summary).toEqual({ internalized: 1, active: 1, queued: 0 });
    expect(statsAll.counts.streakDays).toBe(3); // 09-13, 09-14, 09-15

    // filter = action: summary 仅计 action，streak 仍然是全局 3 天
    const statsAction = computeStats(cards, states, "action", "2026-09-15");
    expect(statsAction.counts.summary).toEqual({ internalized: 0, active: 1, queued: 0 });
    expect(statsAction.counts.streakDays).toBe(3);

    // filter = flash: summary 仅计 flash
    const statsFlash = computeStats(cards, states, "flash", "2026-09-15");
    expect(statsFlash.counts.summary).toEqual({ internalized: 1, active: 0, queued: 0 });
    expect(statsFlash.counts.streakDays).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/stats.test.ts`
Expected: FAIL with Cannot find module '@/lib/stats'

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/stats.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/stats.test.ts`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts tests/stats.test.ts
git commit -m "feat(stats): 核心统计函数与数量状态摘要"
```

---

### Task 2: 标签分布与 16 周热力图引擎 (src/lib/stats.ts)

**Files:**
- Modify: `src/lib/stats.ts`
- Modify: `tests/stats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// 追加到 tests/stats.test.ts
describe("computeStats - 标签与 16 周热力图", () => {
  const mockCardWithTags = (id: string, kind: "action" | "flash", doTags: string[], trainTags: string[]): Card => ({
    id,
    folderToken: "f1",
    kind,
    source: {
      url: `https://zhihu.com/test/${id}`,
      title: `卡片 ${id}`,
      contentType: "answer",
      favTime: 1700000000,
      likeCount: 10,
      summary: "摘要",
    },
    tags: { do: doTags, train: trainTags },
    sourceQuote: "原文",
    reason: "理由",
    ...(kind === "action"
      ? { action: "行动", why: "原因", replyDraft: "草稿" }
      : { front: "问", back: "答" }),
  });

  const mockStateWithHistory = (
    id: string,
    kind: "action" | "flash",
    history: { date: string; result: any }[],
  ): CardState => ({
    id,
    kind,
    status: "active",
    box: 1,
    due: "2026-09-15",
    introducedAt: "2026-09-10",
    addedAt: 1700000000,
    history,
  });

  test("标签统计只算有有效记录的独立卡片数，later 不计，同一卡片多次打卡只计 1 次", () => {
    const cards = {
      c1: mockCardWithTags("c1", "action", ["冥想", "生活整理"], ["专注"]),
      c2: mockCardWithTags("c2", "action", ["冥想"], ["自律"]),
      c3: mockCardWithTags("c3", "flash", ["编程"], ["专注"]),
      c4: mockCardWithTags("c4", "action", ["运动"], ["体能"]),
    };
    const states = {
      // c1: 2 次有效记录
      c1: mockStateWithHistory("c1", "action", [
        { date: "2026-09-14", result: "did" },
        { date: "2026-09-15", result: "did" },
      ]),
      // c2: 仅 1 次有效记录
      c2: mockStateWithHistory("c2", "action", [{ date: "2026-09-15", result: "did" }]),
      // c3: 1 次有效记录 (flash)
      c3: mockStateWithHistory("c3", "flash", [{ date: "2026-09-15", result: "remembered" }]),
      // c4: 仅 later，不应计入标签！
      c4: mockStateWithHistory("c4", "action", [{ date: "2026-09-15", result: "later" }]),
    };

    const statsAll = computeStats(cards, states, "all", "2026-09-15");
    // do 标签：冥想 (c1, c2 -> 2), 生活整理 (c1 -> 1), 编程 (c3 -> 1); 运动为 0 不出现
    expect(statsAll.tags.do).toEqual([
      { tag: "冥想", count: 2 },
      { tag: "生活整理", count: 1 },
      { tag: "编程", count: 1 },
    ]);
    // train 标签：专注 (c1, c3 -> 2), 自律 (c2 -> 1)
    expect(statsAll.tags.train).toEqual([
      { tag: "专注", count: 2 },
      { tag: "自律", count: 1 },
    ]);

    // filter = action: 排除 c3 (编程、专注)
    const statsAction = computeStats(cards, states, "action", "2026-09-15");
    expect(statsAction.tags.do).toEqual([
      { tag: "冥想", count: 2 },
      { tag: "生活整理", count: 1 },
    ]);
    expect(statsAction.tags.train).toEqual([
      { tag: "专注", count: 1 },
      { tag: "自律", count: 1 },
    ]);
  });

  test("16 周热力图精准生成 16 周 × 7 天，共 112 天，标记 isToday/inFuture 与热力等级", () => {
    const today = "2026-09-15"; // 星期二
    const cards = { c1: mockCardWithTags("c1", "action", ["冥想"], ["专注"]) };
    const states = {
      c1: mockStateWithHistory("c1", "action", [
        { date: "2026-09-15", result: "did" }, // 当天 1 次
        { date: "2026-09-15", result: "later" }, // later 不计入
        { date: "2026-09-14", result: "did" }, // 昨天 1 次
        { date: "2026-09-08", result: "did" },
        { date: "2026-09-08", result: "did" },
        { date: "2026-09-08", result: "did" },
        { date: "2026-09-08", result: "did" }, // 2026-09-08 有 4 次 -> level 4
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    expect(stats.calendar.weeks.length).toBe(16);
    expect(stats.calendar.weeks.every((w) => w.days.length === 7)).toBe(true);

    // 2026-09-15 是周二（day index 2）
    // 本周起始周日是 2026-09-13，结束周六是 2026-09-19
    // 16周第1天是 2026-09-13 - 15 * 7 = 2026-05-31
    expect(stats.calendar.startDate).toBe("2026-05-31");
    expect(stats.calendar.endDate).toBe("2026-09-19");

    const lastWeek = stats.calendar.weeks[15];
    const todayCell = lastWeek.days.find((d) => d.isToday);
    expect(todayCell).toBeDefined();
    expect(todayCell?.date).toBe("2026-09-15");
    expect(todayCell?.count).toBe(1);
    expect(todayCell?.level).toBe(1);
    expect(todayCell?.inFuture).toBe(false);

    // 周三到周六应为未来日期
    const wedCell = lastWeek.days[3];
    expect(wedCell.date).toBe("2026-09-16");
    expect(wedCell.inFuture).toBe(true);
    expect(wedCell.level).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/stats.test.ts`
Expected: FAIL on tags or calendar assertions

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/stats.ts 完整实现
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
      for (const t of card.tags.do) {
        if (t) doTagMap[t] = (doTagMap[t] || 0) + 1;
      }
      for (const t of card.tags.train) {
        if (t) trainTagMap[t] = (trainTagMap[t] || 0) + 1;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/stats.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts tests/stats.test.ts
git commit -m "feat(stats): 标签统计与16周热力日历生成算法"
```

---

### Task 3: 导航栏集成 (src/components/AppShell.tsx)

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/appshell.test.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

describe("AppShell review tab navigation", () => {
  test("AppShell 包含回顾导航且链接到 /review", () => {
    const content = readFileSync("src/components/AppShell.tsx", "utf-8");
    expect(content).toContain('"review"');
    expect(content).toContain('"/review"');
    expect(content).toContain('"回顾"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/appshell.test.ts`
Expected: FAIL

- [ ] **Step 3: Update AppShell.tsx**

```typescript
// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export interface ClientSession {
  kind: "oauth";
  identity: string;
  user: { name: string; avatar?: string; headline?: string };
}

interface Props {
  active: "plan" | "today" | "review";
  session: ClientSession;
  right?: ReactNode;
  children: ReactNode;
}

export function AppShell({ active, session, right, children }: Props) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  const tab = (href: "/plan" | "/today" | "/review", label: string, key: "plan" | "today" | "review") => (
    <Link
      href={href}
      className={`px-2 py-1 text-sm transition-colors ${active === key ? "text-white border-b border-[var(--seal)]" : "text-wall-dim hover:text-white"}`}
      aria-current={active === key ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <span className="brush text-2xl leading-none text-white">知行</span>
            <span className="hidden text-xs tracking-[0.2em] text-wall-dim sm:inline">无行动，不知乎</span>
          </div>
          <nav className="flex items-center gap-3" aria-label="页面">
            {tab("/today", "今日", "today")}
            {tab("/plan", "筹划", "plan")}
            {tab("/review", "回顾", "review")}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {right}
          <div className="ml-1 flex items-center gap-2 text-sm">
            {session.user.avatar && <img src={session.user.avatar} alt="" className="h-6 w-6 rounded-full" />}
            <span className="text-wall-ink">{session.user.name}</span>
            <button type="button" className="btn btn-text !text-wall-dim hover:!text-white" onClick={logout}>
              退出
            </button>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/appshell.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx tests/appshell.test.ts
git commit -m "feat(nav): AppShell 增加回顾导航栏项"
```

---

### Task 4: 回顾统计三大组件 (StatsCounts, StatsTags, StatsCalendar)

**Files:**
- Create: `src/components/StatsCounts.tsx`
- Create: `src/components/StatsTags.tsx`
- Create: `src/components/StatsCalendar.tsx`
- Create: `tests/stats-components.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/stats-components.test.ts
import { describe, expect, test } from "bun:test";
import { StatsCounts } from "@/components/StatsCounts";
import { StatsTags } from "@/components/StatsTags";
import { StatsCalendar } from "@/components/StatsCalendar";

describe("Review stats components exports and rendering structures", () => {
  test("Components are functions and export correctly", () => {
    expect(typeof StatsCounts).toBe("function");
    expect(typeof StatsTags).toBe("function");
    expect(typeof StatsCalendar).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/stats-components.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement minimal code for the three components**

```typescript
// src/components/StatsCounts.tsx
"use client";

import type { ReviewCounts, StatsFilter } from "@/lib/stats";

interface Props {
  counts: ReviewCounts;
  filter: StatsFilter;
}

export function StatsCounts({ counts, filter }: Props) {
  const { streakDays, summary, action, flash } = counts;
  const showAction = filter === "all" || filter === "action";
  const showFlash = filter === "all" || filter === "flash";

  return (
    <section className="card p-6" aria-label="数量统计">
      {/* 连续天数 */}
      <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">连续践行天数</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="date-num !text-[64px] !leading-none text-white">{streakDays}</span>
            <span className="text-sm text-wall-dim">天</span>
          </div>
        </div>
        <p className="text-xs text-wall-dim">
          {streakDays > 0 ? "日日行，不怕千万里" : "从今日打卡开始第一天"}
        </p>
      </div>

      {/* 状态摘要 */}
      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.16em] text-wall-dim">
          卡片状态{filter === "action" ? " · 行动" : filter === "flash" ? " · 记" : ""}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div className="rounded bg-white/[0.02] p-3">
            <dt className="text-wall-dim">已内化</dt>
            <dd className="mt-1 text-xl font-medium text-white tabular-nums">{summary.internalized}</dd>
          </div>
          <div className="rounded bg-white/[0.02] p-3">
            <dt className="text-wall-dim">在练</dt>
            <dd className="mt-1 text-xl font-medium text-white tabular-nums">{summary.active}</dd>
          </div>
          <div className="rounded bg-white/[0.02] p-3">
            <dt className="text-wall-dim">待开始</dt>
            <dd className="mt-1 text-xl font-medium text-white tabular-nums">{summary.queued}</dd>
          </div>
        </dl>
      </div>

      {/* 行为累计 */}
      <div className="mt-5 border-t border-white/[0.06] pt-5">
        <p className="text-xs uppercase tracking-[0.16em] text-wall-dim">累计打卡交互</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showAction && (
            <div className="rounded border border-white/[0.04] bg-white/[0.01] p-3.5">
              <span className="text-xs font-medium text-white">行动卡</span>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">做了 (did)</span>
                <span className="font-semibold text-white tabular-nums">{action.did} 次</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">今天不做 (later)</span>
                <span className="text-wall-dim tabular-nums">{action.later} 次</span>
              </div>
            </div>
          )}
          {showFlash && (
            <div className="rounded border border-white/[0.04] bg-white/[0.01] p-3.5">
              <span className="text-xs font-medium text-white">闪卡复习</span>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">记得 (remembered)</span>
                <span className="font-semibold text-white tabular-nums">{flash.remembered} 次</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">模糊 (vague)</span>
                <span className="text-wall-dim tabular-nums">{flash.vague} 次</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">忘了 (forgot)</span>
                <span className="text-wall-dim tabular-nums">{flash.forgot} 次</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
```

```typescript
// src/components/StatsTags.tsx
"use client";

import type { ReviewTags } from "@/lib/stats";

interface Props {
  tags: ReviewTags;
}

export function StatsTags({ tags }: Props) {
  const maxDo = Math.max(1, ...tags.do.map((t) => t.count));
  const maxTrain = Math.max(1, ...tags.train.map((t) => t.count));

  const renderList = (items: { tag: string; count: number }[], max: number, emptyText: string) => {
    if (items.length === 0) {
      return <p className="py-2 text-xs text-wall-dim">{emptyText}</p>;
    }
    return (
      <div className="space-y-2.5">
        {items.map((item) => {
          const pct = Math.round((item.count / max) * 100);
          return (
            <div key={item.tag} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-wall-ink">{item.tag}</span>
                <span className="text-wall-dim tabular-nums">{item.count} 张卡</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-white/[0.06]" aria-hidden>
                <div
                  className="h-full rounded bg-[var(--seal)] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="card p-6" aria-label="标签沉淀">
      <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">标签分布</p>
      <p className="mt-1 text-xs text-wall-dim">统计包含有效打卡记录的独立卡片数</p>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded border border-white/[0.04] bg-white/[0.01] p-4">
          <p className="mb-3 text-xs font-semibold text-white">做什么 · Do</p>
          {renderList(tags.do, maxDo, "暂无行动标签打卡数据")}
        </div>
        <div className="rounded border border-white/[0.04] bg-white/[0.01] p-4">
          <p className="mb-3 text-xs font-semibold text-white">练什么 · Train</p>
          {renderList(tags.train, maxTrain, "暂无心智标签打卡数据")}
        </div>
      </div>
    </section>
  );
}
```

```typescript
// src/components/StatsCalendar.tsx
"use client";

import type { ReviewCalendar } from "@/lib/stats";

interface Props {
  calendar: ReviewCalendar;
}

const LEVEL_CLASSES: Record<number, string> = {
  0: "bg-white/[0.04]",
  1: "bg-[rgba(200,50,30,0.28)]",
  2: "bg-[rgba(200,50,30,0.52)]",
  3: "bg-[rgba(200,50,30,0.76)]",
  4: "bg-[var(--seal)]",
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function StatsCalendar({ calendar }: Props) {
  const { weeks, totalRecords, startDate, endDate } = calendar;

  return (
    <section className="card p-6" aria-label="16 周打卡热力">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">16 周行动足迹</p>
          <p className="mt-1 text-xs text-wall-dim">
            {startDate} 至 {endDate} · 过去 16 周累计打卡{" "}
            <span className="font-semibold text-white tabular-nums">{totalRecords}</span> 次
          </p>
        </div>
        <span className="text-[11px] text-wall-dim">只看不点</span>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="flex gap-2 text-[10px] text-wall-dim">
          {/* 星期标签列 */}
          <div className="flex flex-col justify-between py-0.5 text-right select-none" aria-hidden>
            <span className="h-3 leading-3 opacity-0">日</span>
            <span className="h-3 leading-3">一</span>
            <span className="h-3 leading-3 opacity-0">二</span>
            <span className="h-3 leading-3">三</span>
            <span className="h-3 leading-3 opacity-0">四</span>
            <span className="h-3 leading-3">五</span>
            <span className="h-3 leading-3 opacity-0">六</span>
          </div>

          {/* 16 周网格 */}
          <div className="flex gap-1">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.days.map((day) => {
                  const bgClass = day.inFuture ? "bg-white/[0.01]" : LEVEL_CLASSES[day.level];
                  const todayRing = day.isToday ? "ring-1 ring-white/80" : "";
                  return (
                    <div
                      key={day.date}
                      className={`h-3 w-3 rounded-xs ${bgClass} ${todayRing}`}
                      title={`${day.date}: ${day.count} 次打卡${day.isToday ? " (今天)" : ""}`}
                      aria-label={`${day.date}: ${day.count} 次打卡`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部图例 */}
      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-wall-dim">
        <span>少</span>
        <span className="h-2.5 w-2.5 rounded-xs bg-white/[0.04]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[rgba(200,50,30,0.28)]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[rgba(200,50,30,0.52)]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[rgba(200,50,30,0.76)]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[var(--seal)]" />
        <span>多</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/stats-components.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/StatsCounts.tsx src/components/StatsTags.tsx src/components/StatsCalendar.tsx tests/stats-components.test.ts
git commit -m "feat(ui): 回顾统计三大组件 (Counts, Tags, Calendar)"
```

---

### Task 5: 回顾页面与路由：ReviewPage 与 /review/page.tsx

**Files:**
- Create: `src/components/ReviewPage.tsx`
- Create: `src/app/review/page.tsx`
- Create: `tests/review-page.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/review-page.test.ts
import { describe, expect, test } from "bun:test";
import { ReviewPage } from "@/components/ReviewPage";

describe("ReviewPage", () => {
  test("ReviewPage component is exported", () => {
    expect(typeof ReviewPage).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/review-page.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement ReviewPage and review route**

```typescript
// src/components/ReviewPage.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StateV2 } from "@/lib/types";
import { emptyState, loadState } from "@/lib/state";
import { computeStats, type StatsFilter } from "@/lib/stats";
import { AppShell, type ClientSession } from "./AppShell";
import { StatsCounts } from "./StatsCounts";
import { StatsTags } from "./StatsTags";
import { StatsCalendar } from "./StatsCalendar";

interface Props {
  session: ClientSession;
  date: string;
  initialKind: StatsFilter;
}

export function ReviewPage({ session, date, initialKind }: Props) {
  const [state, setState] = useState<StateV2>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = loadState(session.identity);
    setState(s);
    setHydrated(true);
  }, [session.identity]);

  const stats = computeStats(state.cards, state.states, initialKind, date);

  const buildUrl = (kind: StatsFilter) => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (date) params.set("date", date);
    const qs = params.toString();
    return qs ? `/review?${qs}` : "/review";
  };

  const tabs: { label: string; kind: StatsFilter }[] = [
    { label: "全部", kind: "all" },
    { label: "行动", kind: "action" },
    { label: "记", kind: "flash" },
  ];

  return (
    <AppShell active="review" session={session}>
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        {/* 顶部标题与副标题 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <h1 className="song text-2xl font-bold tracking-tight text-white">知行回顾</h1>
            <p className="mt-1 text-xs text-wall-dim">温故而知新，日日行，不怕千万里</p>
          </div>

          {/* 页内筛选器 */}
          <nav className="flex items-center gap-1 rounded bg-white/[0.04] p-1 text-xs" aria-label="筛选维度">
            {tabs.map((t) => (
              <Link
                key={t.kind}
                href={buildUrl(t.kind)}
                className={`rounded px-3 py-1.5 transition-colors ${
                  initialKind === t.kind
                    ? "bg-[var(--seal)] font-medium text-white shadow-xs"
                    : "text-wall-dim hover:text-white"
                }`}
                aria-current={initialKind === t.kind ? "page" : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* 内容区域 */}
        {!hydrated ? (
          <div className="card h-64 animate-pulse p-6" aria-busy="true" />
        ) : stats.emptyTier === "no_cards" ? (
          /* 第一档空态：无卡 */
          <div className="card p-8 text-center">
            <h2 className="song text-lg font-medium text-white">还没有加入任何卡片</h2>
            <p className="mt-2 text-xs text-wall-dim">知行尚未开启，去筹划页挑几张感兴趣的干货吧。</p>
            <div className="mt-6">
              <Link href="/plan" className="btn btn-seal inline-flex">
                去筹划页挑几张
              </Link>
            </div>
          </div>
        ) : stats.emptyTier === "no_records" ? (
          /* 第二档空态：有卡无有效记录 */
          <div className="card p-8 text-center">
            <h2 className="song text-lg font-medium text-white">还没有打卡记录</h2>
            <p className="mt-2 text-xs text-wall-dim">已选入卡片，今天开始实践你的第一个两分钟行动或记忆闪卡。</p>
            <div className="mt-6">
              <Link href={`/today?date=${date}`} className="btn btn-seal inline-flex">
                从今日开始
              </Link>
            </div>
          </div>
        ) : (
          /* 正常渲染三块 */
          <div className="space-y-6">
            <StatsCounts counts={stats.counts} filter={initialKind} />
            <StatsTags tags={stats.tags} />
            <StatsCalendar calendar={stats.calendar} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

```typescript
// src/app/review/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isValidISODate, todayISO } from "@/lib/dates";
import { ReviewPage } from "@/components/ReviewPage";
import type { StatsFilter } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; kind?: string }>;
}) {
  const [s, params] = await Promise.all([getSession(), searchParams]);
  if (!s) redirect("/");

  const date = params.date && isValidISODate(params.date) ? params.date : todayISO();
  const kind: StatsFilter =
    params.kind === "action" || params.kind === "flash" ? params.kind : "all";

  return (
    <ReviewPage
      session={{ kind: s.kind, identity: s.identity, user: s.user }}
      date={date}
      initialKind={kind}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/review-page.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ReviewPage.tsx src/app/review/page.tsx tests/review-page.test.ts
git commit -m "feat(review): 回顾页面 ReviewPage 与路由 /review"
```

---

### Task 6: 完整验证与边界回归测试 (tests/stats.test.ts & 全项目单测)

**Files:**
- Modify: `tests/stats.test.ts`

- [ ] **Step 1: Write additional comprehensive edge cases in tests/stats.test.ts**

```typescript
// 扩展 tests/stats.test.ts
describe("computeStats - 边界与完整性", () => {
  test("隔天无打卡导致 streak 中断，昨天有打卡今天无打卡延续 streak", () => {
    const cards = {};
    const states = {
      c1: {
        id: "c1",
        kind: "action" as const,
        status: "active" as const,
        box: 1,
        due: "2026-09-15",
        introducedAt: "2026-09-10",
        addedAt: 1700000000,
        history: [{ date: "2026-09-14", result: "did" as const }],
      },
    };
    // 昨天有打卡，今天虽然无打卡，streak 应为 1
    const s1 = computeStats(cards, states, "all", "2026-09-15");
    expect(s1.counts.streakDays).toBe(1);

    // 若最后一次打卡在 2026-09-13 (中间断了 09-14)，streak 应重置为 0
    const statesBroken = {
      c1: {
        ...states.c1,
        history: [{ date: "2026-09-13", result: "did" as const }],
      },
    };
    const s2 = computeStats(cards, statesBroken, "all", "2026-09-15");
    expect(s2.counts.streakDays).toBe(0);
  });

  test("16 周日历各级热力值映射准确：1->1, 2->2, 3->3, 4+->4", () => {
    const cards = {};
    const states = {
      c1: {
        id: "c1",
        kind: "action" as const,
        status: "active" as const,
        box: 1,
        due: "2026-09-15",
        introducedAt: "2026-09-10",
        addedAt: 1700000000,
        history: [
          { date: "2026-09-10", result: "did" as const },
          { date: "2026-09-11", result: "did" as const },
          { date: "2026-09-11", result: "remembered" as const },
          { date: "2026-09-12", result: "did" as const },
          { date: "2026-09-12", result: "remembered" as const },
          { date: "2026-09-12", result: "forgot" as const },
          { date: "2026-09-13", result: "did" as const },
          { date: "2026-09-13", result: "remembered" as const },
          { date: "2026-09-13", result: "vague" as const },
          { date: "2026-09-13", result: "forgot" as const },
          { date: "2026-09-13", result: "did" as const }, // 5 次
        ],
      },
    };
    const s = computeStats(cards, states, "all", "2026-09-15");
    const allDays = s.calendar.weeks.flatMap((w) => w.days);
    expect(allDays.find((d) => d.date === "2026-09-10")?.level).toBe(1);
    expect(allDays.find((d) => d.date === "2026-09-11")?.level).toBe(2);
    expect(allDays.find((d) => d.date === "2026-09-12")?.level).toBe(3);
    expect(allDays.find((d) => d.date === "2026-09-13")?.level).toBe(4);
  });
});
```

- [ ] **Step 2: Run full test suite**

Run: `bun run test`
Expected: 0 fail, all tests passing with exit code 0.

- [ ] **Step 3: Commit**

```bash
git add tests/stats.test.ts
git commit -m "test(stats): 补充边界回归测试与完整覆盖"
```
