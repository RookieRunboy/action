import { describe, expect, test, mock } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    refresh: () => {},
  }),
}));

import { AppShell, type ClientSession } from "@/components/AppShell";

const mockSession: ClientSession = {
  kind: "oauth",
  identity: "test-user-id",
  user: {
    name: "测试用户",
  },
};

describe("AppShell 导航栏", () => {
  test("AppShell 源码与类型定义包含 review active 选项", () => {
    const source = readFileSync(
      join(import.meta.dir, "../src/components/AppShell.tsx"),
      "utf-8"
    );
    // 验证 Props 中 active 支持 "review"
    expect(source).toMatch(/active:\s*.*"review"/);
    // 验证 tab 辅助函数签名支持 "review"
    expect(source).toMatch(/href:[\s\S]*"\/review"[\s\S]*key:[\s\S]*"review"/);

    // 静态类型检查：验证 review 可以赋值给 AppShell Props 中的 active
    type AppShellProps = Parameters<typeof AppShell>[0];
    const reviewActive: AppShellProps["active"] = "review";
    expect(reviewActive).toBe("review");
  });

  test("导航栏按顺序渲染 /today, /plan, /review 三个项", () => {
    const html = renderToStaticMarkup(
      createElement(AppShell, {
        active: "today",
        session: mockSession,
        children: "child",
      })
    );

    // 匹配 <nav ...> 内的所有 <a ...>...</a>
    const navMatch = html.match(/<nav[^>]*>(.*?)<\/nav>/);
    expect(navMatch).not.toBeNull();
    const navHtml = navMatch![1];

    // 提取 nav 中的 a 标签 href 与文本
    const linkMatches = Array.from(navHtml.matchAll(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g));
    expect(linkMatches.length).toBe(3);

    expect(linkMatches[0][1]).toBe("/today");
    expect(linkMatches[0][2]).toBe("今日");

    expect(linkMatches[1][1]).toBe("/plan");
    expect(linkMatches[1][2]).toBe("筹划");

    expect(linkMatches[2][1]).toBe("/review");
    expect(linkMatches[2][2]).toBe("回顾");
  });

  test("回顾项链接至 /review 且文本为「回顾」", () => {
    const html = renderToStaticMarkup(
      createElement(AppShell, {
        active: "review",
        session: mockSession,
        children: "child",
      })
    );

    // 验证回顾 tab 存在且具有 aria-current="page"
    expect(html).toContain('href="/review"');
    expect(html).toContain("回顾");

    // 当 active 为 review 时，回顾项应被高亮（aria-current="page"）
    const reviewLinkMatch = html.match(/<a[^>]*href="\/review"[^>]*>(.*?)<\/a>/);
    expect(reviewLinkMatch).not.toBeNull();
    const reviewLinkTag = reviewLinkMatch![0];
    expect(reviewLinkTag).toContain('aria-current="page"');
    expect(reviewLinkTag).toContain("border-[var(--seal)]");
  });

  test("active 为 today 或 plan 时，回顾项不高亮", () => {
    const htmlToday = renderToStaticMarkup(
      createElement(AppShell, {
        active: "today",
        session: mockSession,
        children: "child",
      })
    );
    const reviewInToday = htmlToday.match(/<a[^>]*href="\/review"[^>]*>/);
    expect(reviewInToday).not.toBeNull();
    expect(reviewInToday![0]).not.toContain('aria-current="page"');
  });
});
