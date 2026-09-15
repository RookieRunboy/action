import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatsCounts } from "@/components/StatsCounts";
import { StatsTags } from "@/components/StatsTags";
import { StatsCalendar } from "@/components/StatsCalendar";
import type { ReviewCounts, ReviewTags, ReviewCalendar, CalendarWeek, CalendarCell } from "@/lib/stats";

describe("StatsCounts component", () => {
  const sampleCounts: ReviewCounts = {
    streakDays: 7,
    summary: {
      internalized: 5,
      active: 3,
      queued: 2,
    },
    action: {
      did: 42,
      later: 8,
    },
    flash: {
      remembered: 30,
      vague: 6,
      forgot: 2,
    },
  };

  test("Component is a function and exports correctly", () => {
    expect(typeof StatsCounts).toBe("function");
  });

  test("renders streakDays > 0 with motivational text and day unit", () => {
    const html = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "all" })
    );

    expect(html).toContain("连续践行天数");
    expect(html).toContain("7");
    expect(html).toContain("天");
    expect(html).toContain("日日行，不怕千万里");
  });

  test("renders streakDays === 0 with starter text", () => {
    const zeroStreak: ReviewCounts = {
      ...sampleCounts,
      streakDays: 0,
    };
    const html = renderToStaticMarkup(
      createElement(StatsCounts, { counts: zeroStreak, filter: "all" })
    );

    expect(html).toContain("0");
    expect(html).toContain("从今日打卡开始第一天");
  });

  test("renders summary card status counts for internalized, active, queued", () => {
    const html = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "all" })
    );

    expect(html).toContain("已内化");
    expect(html).toContain("5");
    expect(html).toContain("在练");
    expect(html).toContain("3");
    expect(html).toContain("待开始");
    expect(html).toContain("2");
  });

  test("renders summary header title corresponding to filter", () => {
    const htmlAll = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "all" })
    );
    expect(htmlAll).toContain("卡片状态");
    expect(htmlAll).not.toContain("卡片状态 · 行动");
    expect(htmlAll).not.toContain("卡片状态 · 记");

    const htmlAction = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "action" })
    );
    expect(htmlAction).toContain("卡片状态 · 行动");

    const htmlFlash = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "flash" })
    );
    expect(htmlFlash).toContain("卡片状态 · 记");
  });

  test("filter='all' renders both action and flash cumulative interaction sections", () => {
    const html = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "all" })
    );

    expect(html).toContain("行动卡");
    expect(html).toContain("做了 (did)");
    expect(html).toContain("42 次");
    expect(html).toContain("今天不做 (later)");
    expect(html).toContain("8 次");

    expect(html).toContain("闪卡复习");
    expect(html).toContain("记得 (remembered)");
    expect(html).toContain("30 次");
    expect(html).toContain("模糊 (vague)");
    expect(html).toContain("6 次");
    expect(html).toContain("忘了 (forgot)");
    expect(html).toContain("2 次");
  });

  test("filter='action' renders only action section, omitting flash section", () => {
    const html = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "action" })
    );

    expect(html).toContain("行动卡");
    expect(html).toContain("做了 (did)");
    expect(html).toContain("今天不做 (later)");

    expect(html).not.toContain("闪卡复习");
    expect(html).not.toContain("记得 (remembered)");
  });

  test("filter='flash' renders only flash section, omitting action section", () => {
    const html = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "flash" })
    );

    expect(html).toContain("闪卡复习");
    expect(html).toContain("记得 (remembered)");
    expect(html).toContain("模糊 (vague)");
    expect(html).toContain("忘了 (forgot)");

    expect(html).not.toContain("行动卡");
    expect(html).not.toContain("做了 (did)");
  });

  test("renders with card styling and semantic aria-label and h2 section titles", () => {
    const html = renderToStaticMarkup(
      createElement(StatsCounts, { counts: sampleCounts, filter: "all" })
    );

    expect(html).toContain('class="card p-6"');
    expect(html).toContain('aria-label="数量统计"');
    expect(html).toContain("<h2");
    expect(html).toContain(">连续践行天数</h2>");
    expect(html).toContain(">卡片状态</h2>");
    expect(html).toContain(">累计打卡交互</h2>");
  });
});

describe("StatsTags component", () => {
  const sampleTags: ReviewTags = {
    do: [
      { tag: "晨间习惯", count: 10 },
      { tag: "深度工作", count: 5 },
    ],
    train: [
      { tag: "认知重构", count: 8 },
      { tag: "注意力聚焦", count: 4 },
    ],
  };

  test("Component is a function and exports correctly", () => {
    expect(typeof StatsTags).toBe("function");
  });

  test("renders do tags and train tags with counts", () => {
    const html = renderToStaticMarkup(
      createElement(StatsTags, { tags: sampleTags })
    );

    expect(html).toContain("做什么 · Do");
    expect(html).toContain("晨间习惯");
    expect(html).toContain("10 张卡");
    expect(html).toContain("深度工作");
    expect(html).toContain("5 张卡");

    expect(html).toContain("练什么 · Train");
    expect(html).toContain("认知重构");
    expect(html).toContain("8 张卡");
    expect(html).toContain("注意力聚焦");
    expect(html).toContain("4 张卡");
  });

  test("renders percentage bars normalized to the maximum tag count", () => {
    const html = renderToStaticMarkup(
      createElement(StatsTags, { tags: sampleTags })
    );

    // do: max is 10 -> 晨间习惯 100%, 深度工作 50%
    expect(html).toContain("width:100%");
    expect(html).toContain("width:50%");
  });

  test("renders empty state messages when tag lists are empty", () => {
    const emptyTags: ReviewTags = {
      do: [],
      train: [],
    };
    const html = renderToStaticMarkup(
      createElement(StatsTags, { tags: emptyTags })
    );

    expect(html).toContain("暂无行动标签打卡数据");
    expect(html).toContain("暂无心智标签打卡数据");
  });

  test("renders empty message only for empty dimension when one has data", () => {
    const partialTags: ReviewTags = {
      do: [{ tag: "写作", count: 3 }],
      train: [],
    };
    const html = renderToStaticMarkup(
      createElement(StatsTags, { tags: partialTags })
    );

    expect(html).toContain("写作");
    expect(html).toContain("3 张卡");
    expect(html).not.toContain("暂无行动标签打卡数据");
    expect(html).toContain("暂无心智标签打卡数据");
  });

  test("renders with card styling, semantic h2/h3 headers, and ul/li elements", () => {
    const html = renderToStaticMarkup(
      createElement(StatsTags, { tags: sampleTags })
    );

    expect(html).toContain('class="card p-6"');
    expect(html).toContain('aria-label="标签沉淀"');
    expect(html).toContain("<h2");
    expect(html).toContain(">标签分布</h2>");
    expect(html).toContain("<h3");
    expect(html).toContain(">做什么 · Do</h3>");
    expect(html).toContain(">练什么 · Train</h3>");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
  });
});

describe("StatsCalendar component", () => {
  function createSampleCalendar(): ReviewCalendar {
    const weeks: CalendarWeek[] = [];
    let total = 0;

    for (let w = 0; w < 16; w++) {
      const days: CalendarCell[] = [];
      for (let d = 0; d < 7; d++) {
        const isToday = w === 15 && d === 2; // Week 15 Tuesday is today
        const inFuture = w === 15 && d > 2;
        let count = 0;
        let level: 0 | 1 | 2 | 3 | 4 = 0;

        if (!inFuture) {
          // Assign levels for testing
          if (w === 0 && d === 0) {
            count = 0;
            level = 0;
          } else if (w === 0 && d === 1) {
            count = 1;
            level = 1;
          } else if (w === 0 && d === 2) {
            count = 2;
            level = 2;
          } else if (w === 0 && d === 3) {
            count = 3;
            level = 3;
          } else if (w === 0 && d === 4) {
            count = 5;
            level = 4;
          }
          total += count;
        }

        const dateStr = `2026-05-${String(w * 7 + d + 1).padStart(2, "0")}`;
        days.push({
          date: dateStr,
          count,
          level,
          isToday,
          inFuture,
        });
      }
      weeks.push({ days });
    }

    return {
      weeks,
      startDate: "2026-05-24",
      endDate: "2026-09-12",
      totalRecords: total,
    };
  }

  test("Component is a function and exports correctly", () => {
    expect(typeof StatsCalendar).toBe("function");
  });

  test("renders header title h2, date range, total records, and read-only badge", () => {
    const calendar = createSampleCalendar();
    const html = renderToStaticMarkup(
      createElement(StatsCalendar, { calendar })
    );

    expect(html).toContain("<h2");
    expect(html).toContain(">16 周行动足迹</h2>");
    expect(html).toContain("2026-05-24 至 2026-09-12");
    expect(html).toContain(`过去 16 周累计打卡`);
    expect(html).toContain(`${calendar.totalRecords}`);
    expect(html).toContain("只看不点");
  });

  test("renders weekday labels including 一, 三, 五 aligned with gap-1", () => {
    const calendar = createSampleCalendar();
    const html = renderToStaticMarkup(
      createElement(StatsCalendar, { calendar })
    );

    expect(html).toContain("flex flex-col gap-1");
    expect(html).toContain("一");
    expect(html).toContain("三");
    expect(html).toContain("五");
  });

  test("renders exactly 16 week columns and 112 day cells with role='img'", () => {
    const calendar = createSampleCalendar();
    const html = renderToStaticMarkup(
      createElement(StatsCalendar, { calendar })
    );

    // Each cell has role="img" and aria-label="YYYY-MM-DD: N 次打卡[ (今天)]"
    const cellMatches = Array.from(html.matchAll(/role="img"[^>]*aria-label="[\d-]+: \d+ 次打卡(?:\s*\(今天\))?"/g));
    expect(cellMatches.length).toBe(112);
  });

  test("renders correct level color classes for 0, 1, 2, 3, 4 and future", () => {
    const calendar = createSampleCalendar();
    const html = renderToStaticMarkup(
      createElement(StatsCalendar, { calendar })
    );

    // Level 0
    expect(html).toContain("bg-white/[0.04]");
    // Level 1
    expect(html).toContain("bg-[rgba(200,50,30,0.28)]");
    // Level 2
    expect(html).toContain("bg-[rgba(200,50,30,0.52)]");
    // Level 3
    expect(html).toContain("bg-[rgba(200,50,30,0.76)]");
    // Level 4
    expect(html).toContain("bg-[var(--seal)]");
    // Future
    expect(html).toContain("bg-white/[0.01]");
  });

  test("highlights today cell with ring, tooltip text, and aria-label", () => {
    const calendar = createSampleCalendar();
    const html = renderToStaticMarkup(
      createElement(StatsCalendar, { calendar })
    );

    expect(html).toContain("ring-1 ring-white/80");
    expect(html).toContain("(今天)");
    expect(html).toContain('aria-label="2026-05-108: 0 次打卡 (今天)"');
  });

  test("renders bottom legend with 少, 多, and level color blocks", () => {
    const calendar = createSampleCalendar();
    const html = renderToStaticMarkup(
      createElement(StatsCalendar, { calendar })
    );

    expect(html).toContain("少");
    expect(html).toContain("多");
  });

  test("renders with card styling and semantic aria-label", () => {
    const calendar = createSampleCalendar();
    const html = renderToStaticMarkup(
      createElement(StatsCalendar, { calendar })
    );

    expect(html).toContain('class="card p-6"');
    expect(html).toContain('aria-label="16 周打卡热力"');
  });
});
