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
