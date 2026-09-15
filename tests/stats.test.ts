import { describe, expect, test } from "bun:test";
import { computeStats, isEffective } from "@/lib/stats";
import type { Card, CardState } from "@/lib/types";

describe("computeStats - 数量与状态摘要", () => {
  const mockCard = (
    id: string,
    kind: "action" | "flash",
    doTags: string[] = ["冥想"],
    trainTags: string[] = ["专注"],
  ): Card =>
    kind === "action"
      ? {
          id,
          folderToken: "f1",
          kind: "action",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: doTags, train: trainTags },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          action: "深呼吸一分钟",
          why: "平复情绪",
          replyDraft: "感谢",
        }
      : {
          id,
          folderToken: "f1",
          kind: "flash",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: doTags, train: trainTags },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          front: "什么是正念？",
          back: "专注于当下",
        };

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

  test("闪卡交互中 forgot 正常累加到 counts.flash.forgot", () => {
    const cards = { f1: mockCard("f1", "flash") };
    const states = {
      f1: mockState("f1", "flash", "active", [
        { date: "2026-09-13", result: "forgot" },
        { date: "2026-09-14", result: "forgot" },
        { date: "2026-09-15", result: "remembered" },
      ]),
    };
    const stats = computeStats(cards, states, "all", "2026-09-15");
    expect(stats.counts.flash.forgot).toBe(2);
    expect(stats.counts.flash.remembered).toBe(1);
    expect(stats.counts.flash.vague).toBe(0);
  });
});

describe("isEffective standalone utility", () => {
  test("did/remembered/vague/forgot 为有效结果，later 为无效", () => {
    expect(isEffective("did")).toBe(true);
    expect(isEffective("remembered")).toBe(true);
    expect(isEffective("vague")).toBe(true);
    expect(isEffective("forgot")).toBe(true);
    expect(isEffective("later")).toBe(false);
  });
});

describe("computeStats - 标签分布", () => {
  const mockCard = (
    id: string,
    kind: "action" | "flash",
    doTags: string[] = ["冥想"],
    trainTags: string[] = ["专注"],
  ): Card =>
    kind === "action"
      ? {
          id,
          folderToken: "f1",
          kind: "action",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: doTags, train: trainTags },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          action: "深呼吸一分钟",
          why: "平复情绪",
          replyDraft: "感谢",
        }
      : {
          id,
          folderToken: "f1",
          kind: "flash",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: doTags, train: trainTags },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          front: "什么是正念？",
          back: "专注于当下",
        };

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

  test("标签统计仅计入有有效记录的独立卡片数，later 不计，同一卡片多次打卡只计 1 次", () => {
    const cards = {
      c1: mockCard("c1", "action", ["冥想", "生活整理"], ["专注"]),
      c2: mockCard("c2", "action", ["冥想"], ["自律"]),
      c3: mockCard("c3", "flash", ["编程"], ["专注"]),
      c4: mockCard("c4", "action", ["运动"], ["体能"]),
      c5: mockCard("c5", "flash", ["英语"], ["自律"]),
    };
    const states = {
      // c1: 2 次有效打卡，独立卡片数应为 1
      c1: mockState("c1", "action", "active", [
        { date: "2026-09-14", result: "did" },
        { date: "2026-09-15", result: "did" },
      ]),
      // c2: 1 次有效打卡
      c2: mockState("c2", "action", "active", [{ date: "2026-09-15", result: "did" }]),
      // c3: 1 次有效打卡 (remembered)
      c3: mockState("c3", "flash", "active", [{ date: "2026-09-15", result: "remembered" }]),
      // c4: 仅 later，不计入标签！
      c4: mockState("c4", "action", "active", [{ date: "2026-09-15", result: "later" }]),
      // c5: forgot 与 vague 都是有效记录
      c5: mockState("c5", "flash", "active", [
        { date: "2026-09-14", result: "forgot" },
        { date: "2026-09-15", result: "vague" },
      ]),
    };

    const stats = computeStats(cards, states, "all", "2026-09-15");
    // do 标签：冥想 (c1, c2 -> 2), 生活整理 (c1 -> 1), 编程 (c3 -> 1), 英语 (c5 -> 1); 运动为 0
    expect(stats.tags.do).toEqual([
      { tag: "冥想", count: 2 },
      { tag: "生活整理", count: 1 },
      { tag: "编程", count: 1 },
      { tag: "英语", count: 1 },
    ]);
    // train 标签：专注 (c1, c3 -> 2), 自律 (c2, c5 -> 2); 体能为 0
    expect(stats.tags.train).toEqual([
      { tag: "专注", count: 2 },
      { tag: "自律", count: 2 },
    ]);
  });

  test("标签排序：按卡片数降序排列，次数相同时按字典序升序排列", () => {
    const cards = {
      c1: mockCard("c1", "action", ["cherry", "apple"], ["focus"]),
      c2: mockCard("c2", "action", ["banana", "apple"], ["habit"]),
      c3: mockCard("c3", "action", ["date"], ["energy"]),
    };
    const states = {
      c1: mockState("c1", "action", "active", [{ date: "2026-09-15", result: "did" }]),
      c2: mockState("c2", "action", "active", [{ date: "2026-09-15", result: "did" }]),
      c3: mockState("c3", "action", "active", [{ date: "2026-09-15", result: "did" }]),
    };

    const stats = computeStats(cards, states, "all", "2026-09-15");
    expect(stats.tags.do).toEqual([
      { tag: "apple", count: 2 },
      { tag: "banana", count: 1 },
      { tag: "cherry", count: 1 },
      { tag: "date", count: 1 },
    ]);
    expect(stats.tags.train).toEqual([
      { tag: "energy", count: 1 },
      { tag: "focus", count: 1 },
      { tag: "habit", count: 1 },
    ]);
  });

  test("标签统计根据 filter 过滤：action 仅含行动卡，flash 仅含闪卡，all 含两者", () => {
    const cards = {
      a1: mockCard("a1", "action", ["跑步"], ["耐力"]),
      a2: mockCard("a2", "action", ["游泳"], ["耐力"]),
      f1: mockCard("f1", "flash", ["英语"], ["记忆"]),
      f2: mockCard("f2", "flash", ["日语"], ["记忆"]),
    };
    const states = {
      a1: mockState("a1", "action", "active", [{ date: "2026-09-15", result: "did" }]),
      a2: mockState("a2", "action", "active", [{ date: "2026-09-15", result: "did" }]),
      f1: mockState("f1", "flash", "active", [{ date: "2026-09-15", result: "remembered" }]),
      f2: mockState("f2", "flash", "active", [{ date: "2026-09-15", result: "forgot" }]),
    };

    const statsAll = computeStats(cards, states, "all", "2026-09-15");
    expect(statsAll.tags.do).toEqual([
      { tag: "日语", count: 1 },
      { tag: "游泳", count: 1 },
      { tag: "英语", count: 1 },
      { tag: "跑步", count: 1 },
    ]);
    expect(statsAll.tags.train).toEqual([
      { tag: "耐力", count: 2 },
      { tag: "记忆", count: 2 },
    ]);
    expect(statsAll.filteredEffectiveRecords).toBe(4);

    const statsAction = computeStats(cards, states, "action", "2026-09-15");
    expect(statsAction.tags.do).toEqual([
      { tag: "游泳", count: 1 },
      { tag: "跑步", count: 1 },
    ]);
    expect(statsAction.tags.train).toEqual([
      { tag: "耐力", count: 2 },
    ]);
    expect(statsAction.filteredEffectiveRecords).toBe(2);

    const statsFlash = computeStats(cards, states, "flash", "2026-09-15");
    expect(statsFlash.tags.do).toEqual([
      { tag: "日语", count: 1 },
      { tag: "英语", count: 1 },
    ]);
    expect(statsFlash.tags.train).toEqual([
      { tag: "记忆", count: 2 },
    ]);
    expect(statsFlash.filteredEffectiveRecords).toBe(2);
  });
});

describe("computeStats - 16 周热力图", () => {
  const mockCard = (id: string, kind: "action" | "flash"): Card =>
    kind === "action"
      ? {
          id,
          folderToken: "f1",
          kind: "action",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: ["冥想"], train: ["专注"] },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          action: "深呼吸一分钟",
          why: "平复情绪",
          replyDraft: "感谢",
        }
      : {
          id,
          folderToken: "f1",
          kind: "flash",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: ["英语"], train: ["记忆"] },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          front: "什么是正念？",
          back: "专注于当下",
        };

  const mockState = (
    id: string,
    kind: "action" | "flash",
    history: CardState["history"] = [],
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

  test("16 周热力图结构：16 周 × 7 天 = 112 个单元格，起始与结束周日周六对齐", () => {
    const today = "2026-09-15"; // 星期二
    const stats = computeStats({}, {}, "all", today);

    expect(stats.calendar.weeks.length).toBe(16);
    expect(stats.calendar.weeks.every((w) => w.days.length === 7)).toBe(true);

    const totalCells = stats.calendar.weeks.reduce((sum, w) => sum + w.days.length, 0);
    expect(totalCells).toBe(112);

    // 2026-09-15 为周二 (day index 2)
    // 本周周日为 2026-09-13，结束周六为 2026-09-19
    // 16周窗口起始日（前 15 周的周日）为 2026-05-31
    expect(stats.calendar.startDate).toBe("2026-05-31");
    expect(stats.calendar.endDate).toBe("2026-09-19");
    expect(stats.calendar.weeks[0].days[0].date).toBe("2026-05-31");
    expect(stats.calendar.weeks[15].days[6].date).toBe("2026-09-19");
  });

  test("isToday 与 inFuture 标记：今天为 isToday，今天之后 inFuture=true 且 count=0, level=0", () => {
    const today = "2026-09-15";
    // 即使状态中有未来日期的记录，在未来格子里也必须 count=0, level=0
    const cards = { a1: mockCard("a1", "action") };
    const states = {
      a1: mockState("a1", "action", [
        { date: "2026-09-15", result: "did" },
        { date: "2026-09-16", result: "did" },
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    const lastWeek = stats.calendar.weeks[15];

    // 周日 09-13: 过去
    expect(lastWeek.days[0].date).toBe("2026-09-13");
    expect(lastWeek.days[0].isToday).toBe(false);
    expect(lastWeek.days[0].inFuture).toBe(false);

    // 周二 09-15: 今天
    expect(lastWeek.days[2].date).toBe("2026-09-15");
    expect(lastWeek.days[2].isToday).toBe(true);
    expect(lastWeek.days[2].inFuture).toBe(false);
    expect(lastWeek.days[2].count).toBe(1);
    expect(lastWeek.days[2].level).toBe(1);

    // 周三 09-16: 未来（即使有打卡，也 count=0, level=0）
    expect(lastWeek.days[3].date).toBe("2026-09-16");
    expect(lastWeek.days[3].isToday).toBe(false);
    expect(lastWeek.days[3].inFuture).toBe(true);
    expect(lastWeek.days[3].count).toBe(0);
    expect(lastWeek.days[3].level).toBe(0);

    // 周六 09-19: 未来
    expect(lastWeek.days[6].date).toBe("2026-09-19");
    expect(lastWeek.days[6].inFuture).toBe(true);
    expect(lastWeek.days[6].count).toBe(0);
    expect(lastWeek.days[6].level).toBe(0);
  });

  test("热力等级映射（0-4）与 later 严格排除", () => {
    const today = "2026-09-15";
    const cards = { a1: mockCard("a1", "action") };
    const states = {
      a1: mockState("a1", "action", [
        // 09-09: 1 次 -> level 1
        { date: "2026-09-09", result: "did" },
        // 09-10: 2 次 -> level 2
        { date: "2026-09-10", result: "did" },
        { date: "2026-09-10", result: "did" },
        // 09-11: 3 次 -> level 3
        { date: "2026-09-11", result: "did" },
        { date: "2026-09-11", result: "did" },
        { date: "2026-09-11", result: "did" },
        // 09-12: 4 次 -> level 4
        { date: "2026-09-12", result: "did" },
        { date: "2026-09-12", result: "did" },
        { date: "2026-09-12", result: "did" },
        { date: "2026-09-12", result: "did" },
        // 09-13: 5 次 -> level 4
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        // 09-14: 1 did + 3 later -> 仅计 1 次，level 1；later 严格不计
        { date: "2026-09-14", result: "did" },
        { date: "2026-09-14", result: "later" },
        { date: "2026-09-14", result: "later" },
        { date: "2026-09-14", result: "later" },
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    const allCells = stats.calendar.weeks.flatMap((w) => w.days);
    const findCell = (date: string) => allCells.find((c) => c.date === date)!;

    expect(findCell("2026-09-08").count).toBe(0);
    expect(findCell("2026-09-08").level).toBe(0);

    expect(findCell("2026-09-09").count).toBe(1);
    expect(findCell("2026-09-09").level).toBe(1);

    expect(findCell("2026-09-10").count).toBe(2);
    expect(findCell("2026-09-10").level).toBe(2);

    expect(findCell("2026-09-11").count).toBe(3);
    expect(findCell("2026-09-11").level).toBe(3);

    expect(findCell("2026-09-12").count).toBe(4);
    expect(findCell("2026-09-12").level).toBe(4);

    expect(findCell("2026-09-13").count).toBe(5);
    expect(findCell("2026-09-13").level).toBe(4);

    expect(findCell("2026-09-14").count).toBe(1);
    expect(findCell("2026-09-14").level).toBe(1);
  });

  test("热力图 filter 行为与 calendar.totalRecords 汇总", () => {
    const today = "2026-09-15";
    const cards = {
      a1: mockCard("a1", "action"),
      f1: mockCard("f1", "flash"),
    };
    const states = {
      a1: mockState("a1", "action", [
        { date: "2026-09-14", result: "did" },
        { date: "2026-09-15", result: "did" },
        { date: "2026-09-15", result: "did" },
      ]),
      f1: mockState("f1", "flash", [
        { date: "2026-09-15", result: "remembered" },
        { date: "2026-09-15", result: "forgot" },
      ]),
    };

    // filter="all"
    const statsAll = computeStats(cards, states, "all", today);
    const cellsAll = statsAll.calendar.weeks.flatMap((w) => w.days);
    const d14All = cellsAll.find((c) => c.date === "2026-09-14")!;
    const d15All = cellsAll.find((c) => c.date === "2026-09-15")!;
    expect(d14All.count).toBe(1);
    expect(d15All.count).toBe(4); // 2 did + 1 remembered + 1 forgot
    expect(statsAll.calendar.totalRecords).toBe(5);

    // filter="action"
    const statsAction = computeStats(cards, states, "action", today);
    const cellsAction = statsAction.calendar.weeks.flatMap((w) => w.days);
    const d14Action = cellsAction.find((c) => c.date === "2026-09-14")!;
    const d15Action = cellsAction.find((c) => c.date === "2026-09-15")!;
    expect(d14Action.count).toBe(1);
    expect(d15Action.count).toBe(2);
    expect(statsAction.calendar.totalRecords).toBe(3);

    // filter="flash"
    const statsFlash = computeStats(cards, states, "flash", today);
    const cellsFlash = statsFlash.calendar.weeks.flatMap((w) => w.days);
    const d14Flash = cellsFlash.find((c) => c.date === "2026-09-14")!;
    const d15Flash = cellsFlash.find((c) => c.date === "2026-09-15")!;
    expect(d14Flash.count).toBe(0);
    expect(d15Flash.count).toBe(2);
    expect(statsFlash.calendar.totalRecords).toBe(2);
  });

  test("16 周窗口之外的历史记录不计入 calendar.totalRecords 和日历格子", () => {
    const today = "2026-09-15";
    const cards = { a1: mockCard("a1", "action") };
    const states = {
      a1: mockState("a1", "action", [
        // 2026-05-30 在窗口起始日 2026-05-31 之前 1 天
        { date: "2026-05-30", result: "did" },
        { date: "2026-09-15", result: "did" },
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    expect(stats.totalEffectiveRecords).toBe(2);
    // calendar.totalRecords 只计算 16 周窗口内的条数
    expect(stats.calendar.totalRecords).toBe(1);

    const allCells = stats.calendar.weeks.flatMap((w) => w.days);
    expect(allCells.some((c) => c.date === "2026-05-30")).toBe(false);
  });
});

describe("computeStats - 边界与回归测试 (Edge cases & regression)", () => {
  const mockCard = (id: string, kind: "action" | "flash"): Card =>
    kind === "action"
      ? {
          id,
          folderToken: "f1",
          kind: "action",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: ["专注"], train: ["自律"] },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          action: "行动描述",
          why: "行动理由",
          replyDraft: "感谢",
        }
      : {
          id,
          folderToken: "f1",
          kind: "flash",
          source: {
            url: `https://zhihu.com/question/1/answer/${id}`,
            title: `卡片 ${id}`,
            contentType: "answer",
            favTime: 1700000000,
            likeCount: 10,
            summary: "摘要",
          },
          tags: { do: ["英语"], train: ["记忆"] },
          sourceQuote: "摘要原文",
          reason: "分拣理由",
          front: "问题",
          back: "答案",
        };

  const mockState = (
    id: string,
    kind: "action" | "flash",
    history: CardState["history"] = [],
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

  test("连续打卡断档：最后一次打卡在 2026-09-13，2026-09-14 无打卡，今天是 2026-09-15 -> streakDays 为 0 (Gap in check-ins breaks streak)", () => {
    const today = "2026-09-15";
    const cards = { a1: mockCard("a1", "action") };
    const states = {
      a1: mockState("a1", "action", [
        { date: "2026-09-13", result: "did" },
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    expect(stats.counts.streakDays).toBe(0);

    // 验证不同 filter 下 streakDays 均为 0（streak 为全局统计，不受 filter 影响）
    const statsAction = computeStats(cards, states, "action", today);
    expect(statsAction.counts.streakDays).toBe(0);
    const statsFlash = computeStats(cards, states, "flash", today);
    expect(statsFlash.counts.streakDays).toBe(0);
  });

  test("连续打卡延续：昨天 2026-09-14 有打卡，今天 2026-09-15 尚无打卡 -> streakDays 为 1 (Streak continues)", () => {
    const today = "2026-09-15";
    const cards = { a1: mockCard("a1", "action") };
    const states = {
      a1: mockState("a1", "action", [
        { date: "2026-09-14", result: "did" },
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    expect(stats.counts.streakDays).toBe(1);

    const statsAction = computeStats(cards, states, "action", today);
    expect(statsAction.counts.streakDays).toBe(1);
    const statsFlash = computeStats(cards, states, "flash", today);
    expect(statsFlash.counts.streakDays).toBe(1);
  });

  test("昨天 2026-09-14 和今天 2026-09-15 均有打卡 -> streakDays 为 2 (Check-in on both yesterday and today)", () => {
    const today = "2026-09-15";
    const cards = {
      a1: mockCard("a1", "action"),
      f1: mockCard("f1", "flash"),
    };
    const states = {
      a1: mockState("a1", "action", [
        { date: "2026-09-14", result: "did" },
      ]),
      f1: mockState("f1", "flash", [
        { date: "2026-09-15", result: "remembered" },
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    expect(stats.counts.streakDays).toBe(2);

    // 同一天内多张卡打卡，streak 天数不重复计算
    const statesMulti = {
      a1: mockState("a1", "action", [
        { date: "2026-09-14", result: "did" },
        { date: "2026-09-15", result: "did" },
      ]),
      f1: mockState("f1", "flash", [
        { date: "2026-09-14", result: "forgot" },
        { date: "2026-09-15", result: "vague" },
      ]),
    };
    const statsMulti = computeStats(cards, statesMulti, "all", today);
    expect(statsMulti.counts.streakDays).toBe(2);
  });

  test("热力图等级映射完整边界验证 (Heatmap levels: 0->0, 1->1, 2->2, 3->3, >=4->4, inFuture->0)", () => {
    const today = "2026-09-15"; // 星期二
    const cards = { a1: mockCard("a1", "action") };
    const states = {
      a1: mockState("a1", "action", [
        // 2026-09-08: 0 次打卡 (未在 history 中出现) -> 期望 count: 0, level: 0
        // 2026-09-09: 1 次打卡 -> 期望 count: 1, level: 1
        { date: "2026-09-09", result: "did" },
        // 2026-09-10: 2 次打卡 -> 期望 count: 2, level: 2
        { date: "2026-09-10", result: "did" },
        { date: "2026-09-10", result: "did" },
        // 2026-09-11: 3 次打卡 -> 期望 count: 3, level: 3
        { date: "2026-09-11", result: "did" },
        { date: "2026-09-11", result: "did" },
        { date: "2026-09-11", result: "did" },
        // 2026-09-12: 4 次打卡 -> 期望 count: 4, level: 4
        { date: "2026-09-12", result: "did" },
        { date: "2026-09-12", result: "did" },
        { date: "2026-09-12", result: "did" },
        { date: "2026-09-12", result: "did" },
        // 2026-09-13: 7 次打卡 (>=4) -> 期望 count: 7, level: 4
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        // 2026-09-16 (明天/未来): 即使存在 5 次打卡数据，也必须强制 count: 0, level: 0
        { date: "2026-09-16", result: "did" },
        { date: "2026-09-16", result: "did" },
        { date: "2026-09-16", result: "did" },
        { date: "2026-09-16", result: "did" },
        { date: "2026-09-16", result: "did" },
      ]),
    };

    const stats = computeStats(cards, states, "all", today);
    const cells = stats.calendar.weeks.flatMap((w) => w.days);
    const getCell = (d: string) => cells.find((c) => c.date === d)!;

    // 0 check-ins -> level 0
    const cell0 = getCell("2026-09-08");
    expect(cell0.count).toBe(0);
    expect(cell0.level).toBe(0);
    expect(cell0.inFuture).toBe(false);

    // 1 check-in -> level 1
    const cell1 = getCell("2026-09-09");
    expect(cell1.count).toBe(1);
    expect(cell1.level).toBe(1);

    // 2 check-ins -> level 2
    const cell2 = getCell("2026-09-10");
    expect(cell2.count).toBe(2);
    expect(cell2.level).toBe(2);

    // 3 check-ins -> level 3
    const cell3 = getCell("2026-09-11");
    expect(cell3.count).toBe(3);
    expect(cell3.level).toBe(3);

    // 4 check-ins -> level 4
    const cell4 = getCell("2026-09-12");
    expect(cell4.count).toBe(4);
    expect(cell4.level).toBe(4);

    // 4 or more check-ins (7 次) -> level 4
    const cell7 = getCell("2026-09-13");
    expect(cell7.count).toBe(7);
    expect(cell7.level).toBe(4);

    // inFuture (明天 2026-09-16 含有打卡记录) -> 强制 count: 0, level: 0, inFuture: true
    const cellFutureWithRecords = getCell("2026-09-16");
    expect(cellFutureWithRecords.count).toBe(0);
    expect(cellFutureWithRecords.level).toBe(0);
    expect(cellFutureWithRecords.inFuture).toBe(true);

    // inFuture (后天 2026-09-17 无记录) -> count: 0, level: 0, inFuture: true
    const cellFutureEmpty = getCell("2026-09-17");
    expect(cellFutureEmpty.count).toBe(0);
    expect(cellFutureEmpty.level).toBe(0);
    expect(cellFutureEmpty.inFuture).toBe(true);
  });

  test("日历过滤隔离性验证 (Filter isolation: filter='action' 严格排除闪卡，filter='flash' 严格排除行动卡)", () => {
    const today = "2026-09-15";
    // 设置 3 个不同日期：
    // 2026-09-13: 只有行动卡打卡 (2 次 did)
    // 2026-09-14: 只有闪卡打卡 (1 次 remembered + 1 次 forgot)
    // 2026-09-15: 行动卡打卡 1 次 (did) + 闪卡打卡 2 次 (vague, remembered)
    const cards = {
      a1: mockCard("a1", "action"),
      f1: mockCard("f1", "flash"),
    };
    const states = {
      a1: mockState("a1", "action", [
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-13", result: "did" },
        { date: "2026-09-15", result: "did" },
      ]),
      f1: mockState("f1", "flash", [
        { date: "2026-09-14", result: "remembered" },
        { date: "2026-09-14", result: "forgot" },
        { date: "2026-09-15", result: "vague" },
        { date: "2026-09-15", result: "remembered" },
      ]),
    };

    // 1. filter="all": 包含所有卡片记录
    const statsAll = computeStats(cards, states, "all", today);
    const cellsAll = statsAll.calendar.weeks.flatMap((w) => w.days);
    const getCellAll = (d: string) => cellsAll.find((c) => c.date === d)!;

    expect(getCellAll("2026-09-13").count).toBe(2);
    expect(getCellAll("2026-09-13").level).toBe(2);
    expect(getCellAll("2026-09-14").count).toBe(2);
    expect(getCellAll("2026-09-14").level).toBe(2);
    expect(getCellAll("2026-09-15").count).toBe(3); // 1 did + 1 vague + 1 remembered
    expect(getCellAll("2026-09-15").level).toBe(3);
    // calendar.totalRecords 汇总所有窗口内记录 (2 + 2 + 3 = 7)
    expect(statsAll.calendar.totalRecords).toBe(7);
    expect(statsAll.filteredEffectiveRecords).toBe(7);
    expect(statsAll.totalEffectiveRecords).toBe(7);

    // 2. filter="action": 闪卡记录被严格排除
    const statsAction = computeStats(cards, states, "action", today);
    const cellsAction = statsAction.calendar.weeks.flatMap((w) => w.days);
    const getCellAction = (d: string) => cellsAction.find((c) => c.date === d)!;

    // 09-13 只有行动卡打卡: 2
    expect(getCellAction("2026-09-13").count).toBe(2);
    expect(getCellAction("2026-09-13").level).toBe(2);
    // 09-14 只有闪卡打卡: 闪卡被排除，count 必须为 0, level 为 0
    expect(getCellAction("2026-09-14").count).toBe(0);
    expect(getCellAction("2026-09-14").level).toBe(0);
    // 09-15 行动卡与闪卡混排: 闪卡被排除，仅计行动卡的 1 次
    expect(getCellAction("2026-09-15").count).toBe(1);
    expect(getCellAction("2026-09-15").level).toBe(1);
    // calendar.totalRecords 只包含行动卡 (2 + 0 + 1 = 3)
    expect(statsAction.calendar.totalRecords).toBe(3);
    expect(statsAction.filteredEffectiveRecords).toBe(3);
    // 全局 totalEffectiveRecords 保持 7
    expect(statsAction.totalEffectiveRecords).toBe(7);

    // 3. filter="flash": 行动卡记录被严格排除
    const statsFlash = computeStats(cards, states, "flash", today);
    const cellsFlash = statsFlash.calendar.weeks.flatMap((w) => w.days);
    const getCellFlash = (d: string) => cellsFlash.find((c) => c.date === d)!;

    // 09-13 只有行动卡打卡: 行动卡被排除，count 必须为 0, level 为 0
    expect(getCellFlash("2026-09-13").count).toBe(0);
    expect(getCellFlash("2026-09-13").level).toBe(0);
    // 09-14 只有闪卡打卡: 计入闪卡 2 次
    expect(getCellFlash("2026-09-14").count).toBe(2);
    expect(getCellFlash("2026-09-14").level).toBe(2);
    // 09-15 行动卡与闪卡混排: 行动卡被排除，仅计闪卡的 2 次
    expect(getCellFlash("2026-09-15").count).toBe(2);
    expect(getCellFlash("2026-09-15").level).toBe(2);
    // calendar.totalRecords 只包含闪卡 (0 + 2 + 2 = 4)
    expect(statsFlash.calendar.totalRecords).toBe(4);
    expect(statsFlash.filteredEffectiveRecords).toBe(4);
    // 全局 totalEffectiveRecords 保持 7
    expect(statsFlash.totalEffectiveRecords).toBe(7);
  });
});
