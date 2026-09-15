"use client";

import type { ReviewCounts, StatsFilter } from "@/lib/stats";

interface Props {
  counts: ReviewCounts;
  filter: StatsFilter;
}

export function StatsCounts({ counts, filter }: Props) {
  const { streakDays, summary, action, flash } = counts;
  const showAction = filter === "all" || filter === "action";
  const showFlash = filter === "all" || filter === "flash";

  return (
    <section className="card p-6" aria-label="数量统计">
      {/* 连续天数 */}
      <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-5">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-wall-dim">连续践行天数</h2>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="date-num !text-[64px] !leading-none text-white">{streakDays}</span>
            <span className="text-sm text-wall-dim">天</span>
          </div>
        </div>
        <p className="text-xs text-wall-dim">
          {streakDays > 0 ? "日日行，不怕千万里" : "从今日打卡开始第一天"}
        </p>
      </div>

      {/* 状态摘要 */}
      <div className="mt-5">
        <h2 className="text-xs uppercase tracking-[0.16em] text-wall-dim">
          卡片状态{filter === "action" ? " · 行动" : filter === "flash" ? " · 记" : ""}
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div className="rounded bg-white/[0.02] p-3">
            <dt className="text-wall-dim">已内化</dt>
            <dd className="mt-1 text-xl font-medium text-white tabular-nums">{summary.internalized}</dd>
          </div>
          <div className="rounded bg-white/[0.02] p-3">
            <dt className="text-wall-dim">在练</dt>
            <dd className="mt-1 text-xl font-medium text-white tabular-nums">{summary.active}</dd>
          </div>
          <div className="rounded bg-white/[0.02] p-3">
            <dt className="text-wall-dim">待开始</dt>
            <dd className="mt-1 text-xl font-medium text-white tabular-nums">{summary.queued}</dd>
          </div>
        </dl>
      </div>

      {/* 行为累计 */}
      <div className="mt-5 border-t border-white/[0.06] pt-5">
        <h2 className="text-xs uppercase tracking-[0.16em] text-wall-dim">累计打卡交互</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showAction && (
            <div className="rounded border border-white/[0.04] bg-white/[0.01] p-3.5">
              <span className="text-xs font-medium text-white">行动卡</span>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">做了 (did)</span>
                <span className="font-semibold text-white tabular-nums">{action.did} 次</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">今天不做 (later)</span>
                <span className="text-wall-dim tabular-nums">{action.later} 次</span>
              </div>
            </div>
          )}
          {showFlash && (
            <div className="rounded border border-white/[0.04] bg-white/[0.01] p-3.5">
              <span className="text-xs font-medium text-white">闪卡复习</span>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">记得 (remembered)</span>
                <span className="font-semibold text-white tabular-nums">{flash.remembered} 次</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">模糊 (vague)</span>
                <span className="text-wall-dim tabular-nums">{flash.vague} 次</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-wall-dim">忘了 (forgot)</span>
                <span className="text-wall-dim tabular-nums">{flash.forgot} 次</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
