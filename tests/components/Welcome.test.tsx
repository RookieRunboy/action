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
  expect(html).toContain("收藏夹里几百篇干货？交给 AI 去挑。");
  // DailyAction
  expect(html).toContain("每天两分钟，只做三件事。");
  // CommunityLoop
  expect(html).toContain("让好内容知道自己被用过。");
  // BottomCTA
  expect(html).toContain("是时候给你的收藏夹来一次大扫除了。");
});
