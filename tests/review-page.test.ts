import { describe, expect, test, mock, beforeEach } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ClientSession } from "@/components/AppShell";
import type { Card, CardState, StateV2 } from "@/lib/types";
import { emptyState, loadState, saveState } from "@/lib/state";
import { todayISO } from "@/lib/dates";
import type { Session } from "@/lib/session";

// Mock next/navigation and @/lib/session
let currentSession: Session | null = null;
let redirectedUrl: string | null = null;

mock.module("next/navigation", () => ({
  redirect: (url: string) => {
    redirectedUrl = url;
    const err = Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
      digest: `NEXT_REDIRECT;replace;${url};307;`,
    });
    throw err;
  },
  useRouter: () => ({
    push: () => {},
    refresh: () => {},
  }),
}));

mock.module("@/lib/session", () => ({
  getSession: async () => currentSession,
}));

// Import after mocking
import { ReviewPage } from "@/components/ReviewPage";
import ReviewRoutePage, { dynamic } from "@/app/review/page";

const mockSession: ClientSession = {
  kind: "oauth",
  identity: "u-test-review",
  user: {
    name: "李四",
    avatar: "https://example.com/avatar.png",
  },
};

const mockCard = (
  id: string,
  kind: "action" | "flash",
  doTags: string[] = ["深度阅读"],
  trainTags: string[] = ["专注力"],
): Card =>
  kind === "action"
    ? {
        id,
        folderToken: "f1",
        kind: "action",
        source: {
          url: `https://zhihu.com/q/1/a/${id}`,
          title: `卡片 ${id}`,
          contentType: "answer",
          favTime: 1700000000,
          likeCount: 10,
          summary: "摘要",
        },
        tags: { do: doTags, train: trainTags },
        sourceQuote: "原文引用",
        reason: "理由",
        action: "阅读 5 分钟",
        why: "沉淀心智",
        replyDraft: "好",
      }
    : {
        id,
        folderToken: "f1",
        kind: "flash",
        source: {
          url: `https://zhihu.com/q/1/a/${id}`,
          title: `卡片 ${id}`,
          contentType: "answer",
          favTime: 1700000000,
          likeCount: 10,
          summary: "摘要",
        },
        tags: { do: doTags, train: trainTags },
        sourceQuote: "原文引用",
        reason: "理由",
        front: "正念是什么？",
        back: "专注于当下",
      };

const mockState = (
  id: string,
  kind: "action" | "flash",
  history: CardState["history"] = [],
): CardState => ({
  id,
  kind,
  status: "active",
  box: 1,
  due: "2026-09-15",
  introducedAt: "2026-09-10",
  addedAt: 1700000000,
  history,
});

describe("Review route: /review/page.tsx", () => {
  beforeEach(() => {
    currentSession = null;
    redirectedUrl = null;
  });

  test("route export dynamic is 'force-dynamic'", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  test("Route auth guard: redirects to '/' when session is null", async () => {
    currentSession = null;
    let thrown: unknown = null;
    try {
      await ReviewRoutePage({ searchParams: Promise.resolve({}) });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).not.toBeNull();
    expect(redirectedUrl).toBe("/");
  });

  test("Route parameter parsing: date defaults to todayISO() and kind defaults to 'all'", async () => {
    currentSession = {
      id: "s-1",
      expiresAt: Date.now() + 60000,
      kind: "oauth",
      identity: "u-test-review",
      user: { name: "李四" },
    };

    const element = await ReviewRoutePage({ searchParams: Promise.resolve({}) });
    expect(element).toBeDefined();
    expect(element.type).toBe(ReviewPage);
    expect(element.props.date).toBe(todayISO());
    expect(element.props.initialKind).toBe("all");
    expect(element.props.session).toEqual({
      kind: "oauth",
      identity: "u-test-review",
      user: { name: "李四" },
    });
  });

  test("Route parameter parsing: accepts valid ISO date and falls back to todayISO() on invalid date", async () => {
    currentSession = {
      id: "s-1",
      expiresAt: Date.now() + 60000,
      kind: "oauth",
      identity: "u-test-review",
      user: { name: "李四" },
    };

    const validElem = await ReviewRoutePage({
      searchParams: Promise.resolve({ date: "2026-09-10" }),
    });
    expect(validElem.props.date).toBe("2026-09-10");

    const invalidElem = await ReviewRoutePage({
      searchParams: Promise.resolve({ date: "invalid-date-string" }),
    });
    expect(invalidElem.props.date).toBe(todayISO());
  });

  test("Route parameter parsing: accepts 'action' and 'flash', falls back to 'all' for invalid kind", async () => {
    currentSession = {
      id: "s-1",
      expiresAt: Date.now() + 60000,
      kind: "oauth",
      identity: "u-test-review",
      user: { name: "李四" },
    };

    const actionElem = await ReviewRoutePage({
      searchParams: Promise.resolve({ kind: "action" }),
    });
    expect(actionElem.props.initialKind).toBe("action");

    const flashElem = await ReviewRoutePage({
      searchParams: Promise.resolve({ kind: "flash" }),
    });
    expect(flashElem.props.initialKind).toBe("flash");

    const fallbackElem = await ReviewRoutePage({
      searchParams: Promise.resolve({ kind: "unknown_kind" }),
    });
    expect(fallbackElem.props.initialKind).toBe("all");
  });
});

describe("ReviewPage component rendering", () => {
  const testDate = "2026-09-15";

  test("ReviewPage component is a function and exports correctly", () => {
    expect(typeof ReviewPage).toBe("function");
  });

  test("renders header '知行回顾' and subtitle inside AppShell", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "all",
        initialState: emptyState(),
      }),
    );

    expect(html).toContain("知行回顾");
    expect(html).toContain("温故而知新，日日行，不怕千万里");
    // AppShell nav item for review active
    expect(html).toContain('href="/review"');
    expect(html).toContain("李四");
  });

  test("renders kind switcher tabs ('全部', '行动', '记') with correct URLs preserving ?date=", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "all",
        initialState: emptyState(),
      }),
    );

    // Filter tabs nav
    expect(html).toContain('aria-label="筛选维度"');
    expect(html).toContain('href="/review?date=2026-09-15"');
    expect(html).toContain('href="/review?kind=action&amp;date=2026-09-15"');
    expect(html).toContain('href="/review?kind=flash&amp;date=2026-09-15"');
    expect(html).toContain("全部");
    expect(html).toContain("行动");
    expect(html).toContain("记");
  });

  test("kind switcher highlights the active tab with aria-current='page'", () => {
    // initialKind="all"
    const htmlAll = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "all",
        initialState: emptyState(),
      }),
    );
    const allTabMatch = htmlAll.match(/<a[^>]*href="\/review\?date=2026-09-15"[^>]*>(.*?)<\/a>/);
    expect(allTabMatch).not.toBeNull();
    expect(allTabMatch![0]).toContain('aria-current="page"');
    expect(allTabMatch![0]).toContain("bg-[var(--seal)]");

    // initialKind="action"
    const htmlAction = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "action",
        initialState: emptyState(),
      }),
    );
    const actionTabMatch = htmlAction.match(
      /<a[^>]*href="\/review\?kind=action&amp;date=2026-09-15"[^>]*>(.*?)<\/a>/,
    );
    expect(actionTabMatch).not.toBeNull();
    expect(actionTabMatch![0]).toContain('aria-current="page"');
    expect(actionTabMatch![0]).toContain("bg-[var(--seal)]");

    // initialKind="flash"
    const htmlFlash = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "flash",
        initialState: emptyState(),
      }),
    );
    const flashTabMatch = htmlFlash.match(
      /<a[^>]*href="\/review\?kind=flash&amp;date=2026-09-15"[^>]*>(.*?)<\/a>/,
    );
    expect(flashTabMatch).not.toBeNull();
    expect(flashTabMatch![0]).toContain('aria-current="page"');
    expect(flashTabMatch![0]).toContain("bg-[var(--seal)]");
  });

  test("Tier 1 empty state ('还没有加入任何卡片') renders link to /plan ('去筹划页挑几张')", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "all",
        initialState: emptyState(),
      }),
    );

    expect(html).toContain("还没有加入任何卡片");
    expect(html).toContain("知行尚未开启，去筹划页挑几张感兴趣的干货吧。");
    expect(html).toContain('href="/plan"');
    expect(html).toContain("去筹划页挑几张");

    // Does NOT render stats modules
    expect(html).not.toContain("数量统计");
    expect(html).not.toContain("16 周行动足迹");
  });

  test("Tier 2 empty state ('还没有打卡记录') renders link to /today ('从今日开始')", () => {
    const stateWithCardsNoRecords: StateV2 = {
      ...emptyState(),
      cards: {
        a1: mockCard("a1", "action"),
      },
      states: {
        a1: mockState("a1", "action", [{ date: testDate, result: "later" }]), // later is not effective
      },
    };

    const html = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "all",
        initialState: stateWithCardsNoRecords,
      }),
    );

    expect(html).toContain("还没有打卡记录");
    expect(html).toContain("已选入卡片，今天开始实践你的第一个两分钟行动或记忆闪卡。");
    expect(html).toContain(`href="/today?date=${testDate}"`);
    expect(html).toContain("从今日开始");

    // Does NOT render stats modules
    expect(html).not.toContain("数量统计");
    expect(html).not.toContain("16 周行动足迹");
  });

  test("Normal state renders StatsCounts, StatsTags, StatsCalendar inside max-w-[720px] single column layout", () => {
    const normalState: StateV2 = {
      ...emptyState(),
      cards: {
        a1: mockCard("a1", "action"),
        f1: mockCard("f1", "flash"),
      },
      states: {
        a1: mockState("a1", "action", [{ date: testDate, result: "did" }]),
        f1: mockState("f1", "flash", [{ date: testDate, result: "remembered" }]),
      },
    };

    const html = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "all",
        initialState: normalState,
      }),
    );

    // Single column container max-w-[720px]
    expect(html).toContain("max-w-[720px]");

    // StatsCounts
    expect(html).toContain('aria-label="数量统计"');
    expect(html).toContain("连续践行天数");
    expect(html).toContain("已内化");

    // StatsTags
    expect(html).toContain('aria-label="标签沉淀"');
    expect(html).toContain("标签分布");
    expect(html).toContain("深度阅读");

    // StatsCalendar
    expect(html).toContain('aria-label="16 周打卡热力"');
    expect(html).toContain("16 周行动足迹");
  });

  test("Unhydrated state renders pulse skeleton with aria-busy='true'", () => {
    // When initialState is not provided and localStorage is empty/undefined
    const html = renderToStaticMarkup(
      createElement(ReviewPage, {
        session: mockSession,
        date: testDate,
        initialKind: "all",
      }),
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-pulse");
  });

  test("loads state from storage via loadState(session.identity) when localStorage is available", () => {
    const store: Record<string, string> = {};
    const mockLocalStorage: Storage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      length: 0,
    };
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      mockLocalStorage as unknown as Storage;

    try {
      const savedState: StateV2 = {
        ...emptyState(),
        cards: {
          a1: mockCard("a1", "action"),
        },
        states: {
          a1: mockState("a1", "action", [{ date: testDate, result: "did" }]),
        },
      };
      saveState(mockSession.identity, savedState);

      const html = renderToStaticMarkup(
        createElement(ReviewPage, {
          session: mockSession,
          date: testDate,
          initialKind: "all",
          initialState: loadState(mockSession.identity),
        }),
      );

      expect(html).toContain("连续践行天数");
      expect(html).toContain("16 周行动足迹");
      expect(html).not.toContain("还没有加入任何卡片");
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });
});
