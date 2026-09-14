import { describe, expect, test } from "bun:test";
import { DO_TAGS, TRAIN_TAGS, normalizeTags } from "@/lib/tags";

describe("normalizeTags", () => {
  test("过滤词表外的值并去重", () => {
    const t = normalizeTags({ do: ["冥想", "冥想", "喝酒"], train: ["专注", "飞行"] });
    expect(t).toEqual({ do: ["冥想"], train: ["专注"] });
  });
  test("每维最多两个，保持输入顺序", () => {
    const t = normalizeTags({ do: ["运动", "冥想", "阅读"], train: ["胆识", "自律", "耐心"] });
    expect(t).toEqual({ do: ["运动", "冥想"], train: ["胆识", "自律"] });
  });
  test("do 为空时默认「其他」，train 允许为空", () => {
    expect(normalizeTags({ do: [], train: [] })).toEqual({ do: ["其他"], train: [] });
    expect(normalizeTags(undefined)).toEqual({ do: ["其他"], train: [] });
    expect(normalizeTags({ do: "冥想", train: null })).toEqual({ do: ["冥想"], train: [] });
  });
  test("词表内容符合规范", () => {
    expect(DO_TAGS).toContain("其他");
    expect(DO_TAGS.length).toBe(14);
    expect(TRAIN_TAGS.length).toBe(10);
  });
});
