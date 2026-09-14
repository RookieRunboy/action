import { describe, expect, test } from "bun:test";
import { addDays, isValidISODate } from "@/lib/dates";
import { applyResult, buildQueue, CAPS, INTERVALS, newCardState, NEW_PER_DAY, resultOn, streak, summarize } from "@/lib/schedule";
import type { CardState } from "@/lib/types";

const D = "2026-09-14";

function active(id: string, kind: "action" | "flash", box: number, due: string, extra: Partial<CardState> = {}): CardState {
  return { id, kind, status: "active", box, due, introducedAt: "2026-09-01", addedAt: 1, history: [], ...extra };
}
function queued(id: string, kind: "action" | "flash", addedAt: number): CardState {
  return newCardState(id, kind, addedAt);
}
function index(list: CardState[]) {
  return Object.fromEntries(list.map((s) => [s.id, s]));
}

describe("dates", () => {
  test("addDays 跨月", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-09-14", 15)).toBe("2026-09-29");
  });
  test("isValidISODate", () => {
    expect(isValidISODate("2026-09-14")).toBe(true);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026-9-4")).toBe(false);
  });
});

describe("applyResult", () => {
  test("did：升一格，按旧格间隔到期", () => {
    for (let box = 0; box < 5; box++) {
      const s = applyResult(active("a", "action", box, D), "did", D);
      expect(s.box).toBe(box + 1);
      expect(s.due).toBe(addDays(D, INTERVALS[box]));
      expect(s.status).toBe("active");
      expect(s.history).toEqual([{ date: D, result: "did" }]);
    }
  });
  test("box 5 成功 → 内化，due 为 null", () => {
    const s = applyResult(active("a", "flash", 5, D), "remembered", D);
    expect(s.status).toBe("internalized");
    expect(s.due).toBeNull();
    expect(s.box).toBe(5);
  });
  test("later：格不变，明天到期", () => {
    const s = applyResult(active("a", "action", 3, D), "later", D);
    expect(s.box).toBe(3);
    expect(s.due).toBe(addDays(D, 1));
  });
  test("vague：格不变，明天到期", () => {
    const s = applyResult(active("a", "flash", 2, D), "vague", D);
    expect(s.box).toBe(2);
    expect(s.due).toBe(addDays(D, 1));
  });
  test("forgot：降一格不低于 0，明天到期", () => {
    expect(applyResult(active("a", "flash", 2, D), "forgot", D).box).toBe(1);
    expect(applyResult(active("a", "flash", 0, D), "forgot", D).box).toBe(0);
    expect(applyResult(active("a", "flash", 0, D), "forgot", D).due).toBe(addDays(D, 1));
  });
  test("同一天第二次结果被忽略", () => {
    const once = applyResult(active("a", "action", 0, D), "did", D);
    const twice = applyResult(once, "did", D);
    expect(twice).toEqual(once);
  });
  test("不修改输入对象", () => {
    const input = active("a", "action", 0, D);
    applyResult(input, "did", D);
    expect(input.box).toBe(0);
    expect(input.history).toEqual([]);
  });
});

describe("buildQueue", () => {
  test("到期卡优先，按 box 升序再 due 升序，受上限约束", () => {
    const states = index([
      active("a1", "action", 2, "2026-09-10"),
      active("a2", "action", 0, "2026-09-13"),
      active("a3", "action", 0, "2026-09-12"),
      active("a4", "action", 1, D),
      active("a5", "action", 0, "2026-09-20"), // 未到期
    ]);
    const { queue } = buildQueue(states, D);
    expect(queue.actions).toEqual(["a3", "a2", "a4"]);
    expect(queue.actions.length).toBe(CAPS.action);
  });
  test("有空位时按 addedAt 引入新卡，数量受 NEW_PER_DAY 限制，并激活", () => {
    const states = index([queued("q3", "action", 3), queued("q1", "action", 1), queued("q2", "action", 2)]);
    const r = buildQueue(states, D);
    expect(r.queue.actions).toEqual(["q1", "q2"]);
    expect(r.queue.actions.length).toBe(NEW_PER_DAY.action);
    expect(r.states.q1.status).toBe("active");
    expect(r.states.q1.introducedAt).toBe(D);
    expect(r.states.q1.due).toBe(D);
    expect(r.states.q3.status).toBe("queued");
  });
  test("闪卡上限 5、每日新卡 3", () => {
    const states = index([
      active("f1", "flash", 0, D), active("f2", "flash", 0, D), active("f3", "flash", 0, D),
      queued("n1", "flash", 1), queued("n2", "flash", 2), queued("n3", "flash", 3), queued("n4", "flash", 4),
    ]);
    const { queue } = buildQueue(states, D);
    expect(queue.flash.length).toBe(5);
    expect(queue.flash.slice(0, 3).sort()).toEqual(["f1", "f2", "f3"]);
    expect(queue.flash.slice(3)).toEqual(["n1", "n2"]);
  });
  test("幂等：同一输入两次结果一致，已激活的新卡第二次不再计入新卡额度", () => {
    const states = index([queued("q1", "action", 1), queued("q2", "action", 2), queued("q3", "action", 3)]);
    const first = buildQueue(states, D);
    const second = buildQueue(first.states, D, first.queue);
    expect(second.queue).toEqual(first.queue);
    expect(second.states.q3.status).toBe("queued");
  });
  test("冻结队列中的卡不被移除，即使已有当日结果", () => {
    const done = applyResult(active("a1", "action", 0, D), "did", D); // due 明天
    const states = index([done, active("a2", "action", 0, D), active("a3", "action", 0, D), active("a4", "action", 0, D)]);
    const { queue } = buildQueue(states, D, { actions: ["a1"], flash: [] });
    expect(queue.actions[0]).toBe("a1");
    expect(queue.actions.length).toBe(3);
  });
  test("later 的卡不占上限，会补进一张", () => {
    const later = applyResult(active("a1", "action", 0, D), "later", D);
    const states = index([later, active("a2", "action", 0, D), active("a3", "action", 0, D), active("a4", "action", 0, D)]);
    const { queue } = buildQueue(states, D, { actions: ["a1", "a2", "a3"], flash: [] });
    expect(queue.actions).toEqual(["a1", "a2", "a3", "a4"]);
  });
  test("dismissed 的卡从冻结队列移除", () => {
    const states = index([{ ...active("a1", "action", 0, D), status: "dismissed", due: null }, active("a2", "action", 0, D)]);
    const { queue } = buildQueue(states, D, { actions: ["a1", "a2"], flash: [] });
    expect(queue.actions).toEqual(["a2"]);
  });
  test("不修改输入 states", () => {
    const states = index([queued("q1", "action", 1)]);
    buildQueue(states, D);
    expect(states.q1.status).toBe("queued");
  });
});

describe("streak / summarize / resultOn", () => {
  test("连续天数：later 不算，隔天中断，从今天或昨天起算", () => {
    const h = (entries: [string, "did" | "later" | "remembered"][]): CardState => ({
      ...active("x", "action", 1, D),
      history: entries.map(([date, result]) => ({ date, result })),
    });
    expect(streak(index([h([["2026-09-14", "did"], ["2026-09-13", "did"], ["2026-09-12", "remembered"]])]), D)).toBe(3);
    expect(streak(index([h([["2026-09-13", "did"], ["2026-09-12", "did"]])]), D)).toBe(2);
    expect(streak(index([h([["2026-09-13", "did"], ["2026-09-11", "did"]])]), D)).toBe(1);
    expect(streak(index([h([["2026-09-14", "later"]])]), D)).toBe(0);
    expect(streak({}, D)).toBe(0);
  });
  test("summarize 统计三种状态", () => {
    const states = index([
      queued("q", "action", 1), active("a", "action", 1, D),
      { ...active("i", "flash", 5, D), status: "internalized", due: null },
      { ...active("d", "flash", 1, D), status: "dismissed", due: null },
    ]);
    expect(summarize(states)).toEqual({ internalized: 1, active: 1, queued: 1 });
  });
  test("resultOn 返回当日结果", () => {
    const s = applyResult(active("a", "action", 0, D), "did", D);
    expect(resultOn(s, D)).toBe("did");
    expect(resultOn(s, "2026-09-15")).toBeUndefined();
  });
});
