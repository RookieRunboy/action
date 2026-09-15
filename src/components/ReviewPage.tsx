"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StateV2 } from "@/lib/types";
import { emptyState, loadState } from "@/lib/state";
import { computeStats, type StatsFilter } from "@/lib/stats";
import { AppShell, type ClientSession } from "./AppShell";
import { StatsCounts } from "./StatsCounts";
import { StatsTags } from "./StatsTags";
import { StatsCalendar } from "./StatsCalendar";

export interface ReviewPageProps {
  session: ClientSession;
  date: string;
  initialKind: StatsFilter;
  initialState?: StateV2;
}

export function ReviewPage({ session, date, initialKind, initialState }: ReviewPageProps) {
  const [state, setState] = useState<StateV2>(() => initialState ?? emptyState());
  const [hydrated, setHydrated] = useState(() => Boolean(initialState));

  useEffect(() => {
    if (!initialState) {
      setState(loadState(session.identity));
      setHydrated(true);
    }
  }, [session.identity, initialState]);

  const stats = computeStats(state.cards, state.states, initialKind, date);

  const buildUrl = (kind: StatsFilter) => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (date) params.set("date", date);
    const qs = params.toString();
    return qs ? `/review?${qs}` : "/review";
  };

  const tabs: { label: string; kind: StatsFilter }[] = [
    { label: "全部", kind: "all" },
    { label: "行动", kind: "action" },
    { label: "记", kind: "flash" },
  ];

  return (
    <AppShell active="review" session={session}>
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        {/* 顶部标题与副标题 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <h1 className="song text-2xl font-bold tracking-tight text-white">知行回顾</h1>
            <p className="mt-1 text-xs text-wall-dim">温故而知新，日日行，不怕千万里</p>
          </div>

          {/* 页内筛选器 */}
          <nav className="flex items-center gap-1 rounded bg-white/[0.04] p-1 text-xs" aria-label="筛选维度">
            {tabs.map((t) => (
              <Link
                key={t.kind}
                href={buildUrl(t.kind)}
                className={`rounded px-3 py-1.5 transition-colors ${
                  initialKind === t.kind
                    ? "bg-[var(--seal)] font-medium text-white shadow-xs"
                    : "text-wall-dim hover:text-white"
                }`}
                aria-current={initialKind === t.kind ? "page" : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* 内容区域 */}
        {!hydrated ? (
          <div className="card h-64 animate-pulse p-6" aria-busy="true" />
        ) : stats.emptyTier === "no_cards" ? (
          /* 第一档空态：无卡 */
          <div className="card p-8 text-center">
            <h2 className="song text-lg font-medium text-white">还没有加入任何卡片</h2>
            <p className="mt-2 text-xs text-wall-dim">知行尚未开启，去筹划页挑几张感兴趣的干货吧。</p>
            <div className="mt-6">
              <Link href="/plan" className="btn btn-seal inline-flex">
                去筹划页挑几张
              </Link>
            </div>
          </div>
        ) : stats.emptyTier === "no_records" ? (
          /* 第二档空态：有卡无有效记录 */
          <div className="card p-8 text-center">
            <h2 className="song text-lg font-medium text-white">还没有打卡记录</h2>
            <p className="mt-2 text-xs text-wall-dim">已选入卡片，今天开始实践你的第一个两分钟行动或记忆闪卡。</p>
            <div className="mt-6">
              <Link href={`/today?date=${date}`} className="btn btn-seal inline-flex">
                从今日开始
              </Link>
            </div>
          </div>
        ) : (
          /* 正常渲染三块 */
          <div className="space-y-6">
            <StatsCounts counts={stats.counts} filter={initialKind} />
            <StatsTags tags={stats.tags} />
            <StatsCalendar calendar={stats.calendar} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
