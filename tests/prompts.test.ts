import { describe, expect, test } from "bun:test";
import { ACTION_SYSTEM, SORT_SYSTEM, applyLifeScenePolicy } from "@/lib/prompts";

describe("生活场景提示词", () => {
  test("SORT_SYSTEM 与 ACTION_SYSTEM 写入场景、重复、负荷约束", () => {
    for (const p of [SORT_SYSTEM, ACTION_SYSTEM]) {
      expect(p).toContain("场景");
      expect(p).toContain("重复");
      expect(p).toContain("负荷");
    }
    expect(SORT_SYSTEM).toContain("分拣员");
    expect(ACTION_SYSTEM).toContain("行动教练");
    expect(SORT_SYSTEM).toContain('"kind":"action|knowledge|skip"');
    expect(ACTION_SYSTEM).toContain('"action":"..."');
    expect(ACTION_SYSTEM).toContain('"why":"..."');
    expect(ACTION_SYSTEM).toContain('"sourceQuote":"..."');
    expect(ACTION_SYSTEM).toContain('"replyDraft":"..."');
  });
});

describe("applyLifeScenePolicy", () => {
  test("具名路径：高负荷 skip、技术校准 knowledge、生活微步骤 action", () => {
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "超负荷运球怎么练",
        summary: "左手运球的同时右手持网球 30 秒，用超负荷刺激弱侧。",
      }),
    ).toBe("skip");

    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "如何调坐垫",
        summary: "用吊坠法校准坐垫前后和高度，吊线对准膝前。",
      }),
    ).toBe("knowledge");

    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "脚掌发力",
        summary: "原地踮脚 3 次，只抬脚掌，不要借腿跳。",
      }),
    ).toBe("action");

    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "靠墙站检查体态",
        summary: "靠墙站，后脑勺、肩胛、骶骨、脚跟贴墙。",
      }),
    ).toBe("action");

    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "工位含胸",
        summary: "坐直，交叉抱肘，向后夹肩胛，停两秒。",
      }),
    ).toBe("action");
  });

  test("保留原分拣：冥想 action、人脉 knowledge、游戏 skip", () => {
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "如何冥想",
        summary: "从简到难，依次练习。每天先坐一分钟。",
      }),
    ).toBe("action");
    expect(
      applyLifeScenePolicy({
        kind: "knowledge",
        title: "人脉的本质",
        summary: "结论：跪下。20 来岁最危险的是持有和阶层不匹配的价值观。",
      }),
    ).toBe("knowledge");
    expect(
      applyLifeScenePolicy({
        kind: "skip",
        title: "游戏台词",
        summary: "这句台词让我记住了整部游戏。",
      }),
    ).toBe("skip");
  });

  test("行动原文含运球/网球则收成 knowledge，不是 action", () => {
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "工位拉伸",
        summary: "坐着也能活动肩背。",
        action: "左手运球同时右手持网球 30 秒",
      }),
    ).toBe("knowledge");
  });

  test("无超负荷的运球是运动技术 knowledge，不是 skip", () => {
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "弱手运球",
        summary: "左手运球找节奏，不用网球。",
      }),
    ).toBe("knowledge");
  });

  test("裸「校准」不改分拣；坐垫/吊坠才收成 knowledge", () => {
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "认知校准",
        summary: "先校准自己的判断标准，再做决定。",
      }),
    ).toBe("action");
  });

  test("场地/器械上的 action 收成 knowledge", () => {
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "投篮分解",
        summary: "把投篮拆成准备、发力、随前三个环节。",
      }),
    ).toBe("knowledge");
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "硬拉站距",
        summary: "双脚站距与髋同宽，杠铃贴小腿。",
      }),
    ).toBe("knowledge");
    expect(
      applyLifeScenePolicy({
        kind: "action",
        title: "去健身房的第一周",
        summary: "先熟悉器械，再谈计划。",
      }),
    ).toBe("knowledge");
  });
});
