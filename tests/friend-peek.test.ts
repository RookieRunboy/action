import { describe, expect, test, mock } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import { FriendPeek } from "@/components/FriendPeek";
import { peekKanshan } from "@/lib/friends";
import { KANSHAN_HANDLE, KANSHAN_HEADLINE, KANSHAN_NAME } from "@/lib/kanshan";

describe("FriendPeek", () => {
  test("看山小卡展示习惯、知识点、原文和加入", () => {
    const peek = peekKanshan();
    const html = renderToStaticMarkup(
      createElement(FriendPeek, {
        name: KANSHAN_NAME,
        handle: KANSHAN_HANDLE,
        headline: KANSHAN_HEADLINE,
        peek,
        canAdopt: true,
        adoptedIds: new Set<string>(),
        onAdopt: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain("在执行的习惯");
    expect(html).toContain("在复习的知识点");
    expect(html).toContain(peek.habits[0].text);
    expect(html).toContain(peek.knowledge[0].text);
    expect(html).toContain("加入我的知行");
    expect(html).toContain('aria-label="原文"');
    expect(html).toContain(KANSHAN_HEADLINE);
  });

  test("已加入显示已在知行；我的空态去筹划页", () => {
    const peek = peekKanshan();
    const htmlAdopted = renderToStaticMarkup(
      createElement(FriendPeek, {
        name: KANSHAN_NAME,
        handle: KANSHAN_HANDLE,
        peek,
        canAdopt: true,
        adoptedIds: new Set([peek.knowledge[0].id]),
        onAdopt: () => {},
        onClose: () => {},
      }),
    );
    expect(htmlAdopted).toContain("已在知行");

    const htmlMine = renderToStaticMarkup(
      createElement(FriendPeek, {
        name: "张三",
        handle: "u1",
        peek: { habits: [], knowledge: [], remainingHabits: 0, remainingKnowledge: 0, latest: "还没有在练的" },
        canAdopt: false,
        adoptedIds: new Set<string>(),
        onAdopt: () => {},
        onClose: () => {},
      }),
    );
    expect(htmlMine).toContain("还没有在练的习惯或知识点");
    expect(htmlMine).toContain("/plan");
    expect(htmlMine).not.toContain("加入我的知行");
  });
});
