import { describe, expect, test } from "bun:test";
import { extractJSON, LLMError } from "@/lib/llm";

describe("extractJSON", () => {
  test("纯 JSON", () => expect(extractJSON<{ a: number }>('{"a":1}')).toEqual({ a: 1 }));
  test("```json 围栏", () => expect(extractJSON<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 }));
  test("前后杂文", () => expect(extractJSON<{ items: number[] }>('好的，结果如下：{"items":[1,2]} 以上。')).toEqual({ items: [1, 2] }));
  test("非法输入抛 LLMError", () => {
    expect(() => extractJSON("完全不是 json")).toThrow(LLMError);
  });
});
