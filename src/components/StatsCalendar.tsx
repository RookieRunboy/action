"use client";

import type { ReviewCalendar } from "@/lib/stats";

interface Props {
  calendar: ReviewCalendar;
}

const LEVEL_CLASSES: Record<number, string> = {
  0: "bg-white/[0.04]",
  1: "bg-[rgba(200,50,30,0.28)]",
  2: "bg-[rgba(200,50,30,0.52)]",
  3: "bg-[rgba(200,50,30,0.76)]",
  4: "bg-[var(--seal)]",
};

export function StatsCalendar({ calendar }: Props) {
  const { weeks, totalRecords, startDate, endDate } = calendar;

  return (
    <section className="card p-6" aria-label="16 周打卡热力">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">16 周行动足迹</p>
          <p className="mt-1 text-xs text-wall-dim">
            {startDate} 至 {endDate} · 过去 16 周累计打卡{" "}
            <span className="font-semibold text-white tabular-nums">{totalRecords}</span> 次
          </p>
        </div>
        <span className="text-[11px] text-wall-dim">只看不点</span>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="flex gap-2 text-[10px] text-wall-dim">
          {/* 星期标签列 */}
          <div className="flex flex-col justify-between py-0.5 text-right select-none" aria-hidden>
            <span className="h-3 leading-3 opacity-0">日</span>
            <span className="h-3 leading-3">一</span>
            <span className="h-3 leading-3 opacity-0">二</span>
            <span className="h-3 leading-3">三</span>
            <span className="h-3 leading-3 opacity-0">四</span>
            <span className="h-3 leading-3">五</span>
            <span className="h-3 leading-3 opacity-0">六</span>
          </div>

          {/* 16 周网格 */}
          <div className="flex gap-1">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.days.map((day) => {
                  const bgClass = day.inFuture ? "bg-white/[0.01]" : LEVEL_CLASSES[day.level];
                  const todayRing = day.isToday ? "ring-1 ring-white/80" : "";
                  return (
                    <div
                      key={day.date}
                      className={`h-3 w-3 rounded-xs ${bgClass} ${todayRing}`}
                      title={`${day.date}: ${day.count} 次打卡${day.isToday ? " (今天)" : ""}`}
                      aria-label={`${day.date}: ${day.count} 次打卡`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部图例 */}
      <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-wall-dim">
        <span>少</span>
        <span className="h-2.5 w-2.5 rounded-xs bg-white/[0.04]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[rgba(200,50,30,0.28)]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[rgba(200,50,30,0.52)]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[rgba(200,50,30,0.76)]" />
        <span className="h-2.5 w-2.5 rounded-xs bg-[var(--seal)]" />
        <span>多</span>
      </div>
    </section>
  );
}
