import { describe, expect, test } from "bun:test";
import { addDays, isValidISODate } from "@/lib/dates";
import { advanceGroup, applyResult, buildGroup, GROUP_SIZE, groupComplete, INTERVALS, newCardState, resultOn, streak, summarize } from "@/lib/schedule";
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

function mark(states: Record<string, CardState>, ids: string[], date: string) {
  const next = { ...states };
  for (const id of ids) {
    const result = next[id].kind === "action" ? "did" as const : "remembered" as const;
    next[id] = applyResult(next[id], result, date);
  }
  return next;
}

describe("buildGroup", () => {
  test("混排一组最多 3 张，到期优先（不论 kind），按 box、due、addedAt", () => {
    const states = index([
      active("a-late", "action", 2, "2026-09-10", { addedAt: 10 }),
      active("f-early", "flash", 0, "2026-09-12", { addedAt: 20 }),
      active("a-mid", "action", 0, "2026-09-13", { addedAt: 30 }),
      active("a-box1", "action", 1, D, { addedAt: 40 }),
      active("f-future", "flash", 0, "2026-09-20", { addedAt: 1 }),
      queued("q1", "flash", 1),
    ]);
    const { queue } = buildGroup(states, D);
    expect(queue.ids).toEqual(["f-early", "a-mid", "a-box1"]);
    expect(queue.ids.length).toBe(GROUP_SIZE);
  });
  test("不足 3 张时组可以更小", () => {
    const states = index([active("a1", "action", 0, D), queued("q1", "flash", 1)]);
    expect(buildGroup(states, D).queue.ids).toEqual(["a1", "q1"]);
  });
  test("到期之后按 addedAt 引入 queued，进入组时激活", () => {
    const states = index([
      active("a1", "action", 0, D),
      queued("q3", "flash", 3),
      queued("q1", "action", 1),
      queued("q2", "flash", 2),
    ]);
    const r = buildGroup(states, D);
    expect(r.queue.ids).toEqual(["a1", "q1", "q2"]);
    expect(r.states.q1).toMatchObject({ status: "active", introducedAt: D, due: D });
    expect(r.states.q2).toMatchObject({ status: "active", introducedAt: D, due: D });
    expect(r.states.q3.status).toBe("queued");
  });
  test("跳过 dismissed、internalized、当日已有结果、以及未到期的 active", () => {
    const states = index([
      { ...active("gone", "action", 0, D), status: "dismissed", due: null },
      { ...active("done", "flash", 5, D), status: "internalized", due: null },
      applyResult(active("marked", "action", 0, D), "did", D),
      active("later", "flash", 0, "2026-09-20"),
      queued("q1", "action", 1),
    ]);
    expect(buildGroup(states, D).queue.ids).toEqual(["q1"]);
  });
  test("existing.ids 非空则冻结：不重排、不补位，即使已有当日结果", () => {
    const done = applyResult(active("a1", "action", 0, D), "did", D);
    const states = index([done, active("a2", "action", 0, D), active("a3", "action", 0, D), queued("q1", "flash", 1)]);
    const { queue, states: next } = buildGroup(states, D, { ids: ["a1"] });
    expect(queue.ids).toEqual(["a1"]);
    expect(next.q1.status).toBe("queued");
  });
  test("冻结时丢掉 dismissed，不补位", () => {
    const states = index([
      { ...active("a1", "action", 0, D), status: "dismissed", due: null },
      active("a2", "action", 0, D),
      active("a3", "action", 0, D),
    ]);
    const { queue } = buildGroup(states, D, { ids: ["a1", "a2"] });
    expect(queue.ids).toEqual(["a2"]);
  });
  test("existing 为空或缺失则选取下一组", () => {
    const states = index([queued("q1", "action", 1), queued("q2", "flash", 2)]);
    expect(buildGroup(states, D).queue.ids).toEqual(["q1", "q2"]);
    expect(buildGroup(states, D, { ids: [] }).queue.ids).toEqual(["q1", "q2"]);
  });
  test("幂等：冻结后再次 buildGroup 结果一致，不把组外 queued 拉进来", () => {
    const states = index([
      queued("q1", "action", 1), queued("q2", "action", 2), queued("q3", "action", 3), queued("q4", "action", 4),
    ]);
    const first = buildGroup(states, D);
    const second = buildGroup(first.states, D, first.queue);
    expect(first.queue.ids).toEqual(["q1", "q2", "q3"]);
    expect(second.queue).toEqual(first.queue);
    expect(second.states.q4.status).toBe("queued");
  });
  test("不修改输入 states", () => {
    const states = index([queued("q1", "action", 1)]);
    buildGroup(states, D);
    expect(states.q1.status).toBe("queued");
  });
});

describe("groupComplete / advanceGroup", () => {
  test("组内全部有当日结果才算完成；did/later/remembered/vague/forgot 都算", () => {
    const states = index([
      applyResult(active("a1", "action", 0, D), "did", D),
      applyResult(active("a2", "action", 0, D), "later", D),
      applyResult(active("f1", "flash", 0, D), "remembered", D),
      applyResult(active("f2", "flash", 0, D), "vague", D),
      applyResult(active("f3", "flash", 0, D), "forgot", D),
    ]);
    expect(groupComplete(states, D, { ids: ["a1", "a2", "f1", "f2", "f3"] })).toBe(true);
    expect(groupComplete(index([active("a1", "action", 0, D), active("a2", "action", 0, D)]), D, { ids: ["a1", "a2"] })).toBe(false);
    expect(groupComplete(states, D, { ids: [] })).toBe(true);
  });
  test("未全部标记时 advance 是 no-op", () => {
    const built = buildGroup(index([
      queued("a1", "action", 1), queued("a2", "action", 2), queued("a3", "action", 3), queued("a4", "action", 4),
    ]), D);
    const marked = mark(built.states, built.queue.ids.slice(0, 2), D);
    const advanced = advanceGroup(marked, D, built.queue);
    expect(advanced.queue.ids).toEqual(built.queue.ids);
    expect(advanced.states.a4.status).toBe("queued");
  });
  test("全部标记后进入下一组；没有剩余时为空且刷新不绕回", () => {
    let states = index([queued("a1", "action", 1), queued("f1", "flash", 2), queued("a2", "action", 3)]);
    const first = buildGroup(states, D);
    expect(first.queue.ids).toEqual(["a1", "f1", "a2"]);
    states = mark(first.states, first.queue.ids, D);
    const empty = advanceGroup(states, D, first.queue);
    expect(empty.queue.ids).toEqual([]);
    const again = advanceGroup(empty.states, D, empty.queue);
    expect(again.queue.ids).toEqual([]);
  });
  test("同一天可通过连续分组完成超过 3 张行动和 5 张闪卡", () => {
    const cards = [
      ...["a1", "a2", "a3", "a4"].map((id, i) => queued(id, "action", i + 1)),
      ...["f1", "f2", "f3", "f4", "f5", "f6"].map((id, i) => queued(id, "flash", i + 10)),
    ];
    const first = buildGroup(index(cards), D);
    let states = first.states;
    let queue = first.queue;
    const done = { action: 0, flash: 0 };
    let guard = 0;
    while (queue.ids.length && guard++ < 20) {
      states = mark(states, queue.ids, D);
      for (const id of queue.ids) done[states[id].kind]++;
      const next = advanceGroup(states, D, queue);
      states = next.states;
      queue = next.queue;
    }
    expect(done).toEqual({ action: 4, flash: 6 });
    expect(queue.ids).toEqual([]);
    expect(advanceGroup(states, D, queue).queue.ids).toEqual([]);
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
