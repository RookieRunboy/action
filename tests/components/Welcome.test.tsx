// tests/components/Welcome.test.tsx
import { renderToString } from "react-dom/server";
import { Welcome } from "../../src/components/Welcome";
import { expect, test } from "bun:test";
import React from "react";

test("Welcome page contains all storytelling sections", () => {
  const html = renderToString(<Welcome oauth={true} />);
  // Hero
  expect(html).toContain("你收藏过的每一条干货");
  // AISorting
  expect(html).toContain("收藏夹里几百篇干货？");
  // DailyAction
  expect(html).toContain("每天两分钟，");
  // CommunityLoop
  expect(html).toContain("让好内容知道");
  // BottomCTA
  expect(html).toContain("是时候给你的收藏夹");
});
