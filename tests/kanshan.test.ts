import { describe, expect, test } from "bun:test";
import { itemId } from "@/lib/zhihu";
import {
  KANSHAN_HANDLE,
  KANSHAN_HABITS,
  KANSHAN_HEADLINE,
  KANSHAN_ID,
  KANSHAN_KNOWLEDGE,
  KANSHAN_NAME,
} from "@/lib/kanshan";

describe("看山常量", () => {
  test("人设", () => {
    expect(KANSHAN_ID).toBe("kanshan");
    expect(KANSHAN_NAME).toBe("看山");
    expect(KANSHAN_HANDLE).toBe("kanshan");
    expect(KANSHAN_HEADLINE).toBe("横看成岭侧成峰。值得记住的，做成闪卡给你。");
  });

  test("3 条习惯、6 张闪卡", () => {
    expect(KANSHAN_HABITS).toHaveLength(3);
    expect(KANSHAN_KNOWLEDGE).toHaveLength(6);
    expect(KANSHAN_HABITS.every((c) => c.kind === "action")).toBe(true);
    expect(KANSHAN_KNOWLEDGE.every((c) => c.kind === "flash")).toBe(true);
  });

  test("长度上限", () => {
    for (const c of KANSHAN_HABITS) {
      expect(c.action.length).toBeLessThanOrEqual(40);
      expect(c.why.length).toBeLessThanOrEqual(60);
      expect(c.folderToken).toBe("kanshan");
    }
    for (const c of KANSHAN_KNOWLEDGE) {
      expect(c.front.length).toBeLessThanOrEqual(40);
      expect(c.back.length).toBeLessThanOrEqual(80);
      expect(c.reason.length).toBeLessThanOrEqual(30);
      expect(c.sourceQuote.length).toBeLessThanOrEqual(60);
      expect(c.folderToken).toBe("kanshan");
    }
  });

  test("闪卡 id 互异且等于 itemId(url)", () => {
    const ids = KANSHAN_KNOWLEDGE.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
    for (const c of KANSHAN_KNOWLEDGE) {
      expect(c.id).toBe(itemId(c.source.url));
      expect(c.source.url.startsWith("https://zhuanlan.zhihu.com/p/")).toBe(true);
    }
  });
});
