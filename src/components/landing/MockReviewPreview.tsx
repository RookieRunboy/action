"use client";

/**
 * Interactive mock preview of the Review (回顾) page for landing page.
 * Heatmap cells show tooltip on hover; tag bars animate on mount.
 */
import React, { useState } from "react";

// 16 weeks of mock heatmap data
const RAW_LEVELS = [
  0, 0, 0, 1, 1, 2, 0, 1, 0, 0, 1, 2, 3, 0, 1, 0, 2, 1, 0, 0, 1, 1, 3, 2,
  0, 1, 0, 0, 1, 2, 1, 3, 0, 0, 1, 2, 0, 1, 1, 0, 2, 3, 1, 0, 0, 1, 0, 2, 1,
  0, 1, 2, 3, 4, 1, 0, 1, 0, 2, 1, 1, 3, 0, 1, 2, 0, 1, 1, 2, 0, 3, 1, 2, 1,
  0, 0, 1, 2, 1, 3, 0, 1, 0, 2, 1, 3, 2, 1, 2, 0, 1, 1, 3, 2, 1, 0, 2, 1, 0,
  1, 3, 2, 1, 0, 0, 1, 2, 1, 0, 0, 0, 0,
];

const LEVEL_CLASSES: Record<number, string> = {
  0: "bg-white/[0.04]",
  1: "bg-[rgba(200,50,30,0.28)]",
  2: "bg-[rgba(200,50,30,0.52)]",
  3: "bg-[rgba(200,50,30,0.76)]",
  4: "bg-[var(--seal)]",
};

function buildWeeks() {
  // Start from 16 weeks ago
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 16 * 7 + 1);
  // Align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: {
    days: { level: number; cls: string; date: string; count: number; isFuture: boolean; isToday: boolean }[];
  }[] = [];
  let idx = 0;
  const todayStr = today.toISOString().slice(0, 10);

  for (let w = 0; w < 16; w++) {
    const days: typeof weeks[0]["days"] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + w * 7 + d);
      const dateStr = cellDate.toISOString().slice(0, 10);
      const isFuture = cellDate > today;
      const isToday = dateStr === todayStr;
      const l = RAW_LEVELS[idx] ?? 0;
      const count = l === 0 ? 0 : l;
      days.push({
        level: l,
        cls: isFuture ? "bg-white/[0.01]" : LEVEL_CLASSES[l],
        date: dateStr,
        count,
        isFuture,
        isToday,
      });
      idx++;
    }
    weeks.push({ days });
  }
  return weeks;
}

const MOCK_WEEKS = buildWeeks();

const DO_TAGS = [
  { tag: "运动", count: 12, pct: 100 },
  { tag: "正念", count: 8, pct: 67 },
  { tag: "心理", count: 6, pct: 50 },
  { tag: "阅读", count: 4, pct: 33 },
];

export function MockReviewPreview() {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Heatmap card */}
      <div className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-wall-dim">
              16 周行动足迹
            </h3>
            <p className="mt-0.5 text-[9px] text-wall-dim">
              过去 16 周累计打卡{" "}
              <span className="font-semibold text-white tabular-nums">
                142
              </span>{" "}
              次
            </p>
          </div>
        </div>
        <div className="mt-3 overflow-hidden relative">
          <div className="flex gap-[3px] text-[10px] text-wall-dim">
            {/* Week labels */}
            <div
              className="flex flex-col gap-[3px] text-right select-none"
              aria-hidden
            >
              <span className="h-2 leading-[8px] opacity-0">日</span>
              <span className="h-2 leading-[8px] text-[7px]">一</span>
              <span className="h-2 leading-[8px] opacity-0">二</span>
              <span className="h-2 leading-[8px] text-[7px]">三</span>
              <span className="h-2 leading-[8px] opacity-0">四</span>
              <span className="h-2 leading-[8px] text-[7px]">五</span>
              <span className="h-2 leading-[8px] opacity-0">六</span>
            </div>
            <div className="flex gap-[3px]">
              {MOCK_WEEKS.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.days.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      className={`h-2 w-2 rounded-[1px] ${day.cls} ${day.isToday ? "ring-1 ring-white/80" : ""} transition-transform duration-150 hover:scale-150 cursor-default`}
                      onMouseEnter={(e) => {
                        const rect = (
                          e.target as HTMLElement
                        ).getBoundingClientRect();
                        const parent = (
                          e.target as HTMLElement
                        ).closest(".relative")!.getBoundingClientRect();
                        setTooltip({
                          x: rect.left - parent.left + rect.width / 2,
                          y: rect.top - parent.top - 4,
                          text: `${day.date}: ${day.count} 次打卡${day.isToday ? " (今天)" : ""}`,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-10 px-2 py-1 text-[9px] text-white bg-[var(--ink)] rounded shadow-lg whitespace-nowrap pointer-events-none"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: "translate(-50%, -100%)",
              }}
            >
              {tooltip.text}
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="mt-2.5 flex items-center justify-end gap-1 text-[9px] text-wall-dim">
          <span>少</span>
          <span className="h-2 w-2 rounded-[1px] bg-white/[0.04]" />
          <span className="h-2 w-2 rounded-[1px] bg-[rgba(200,50,30,0.28)]" />
          <span className="h-2 w-2 rounded-[1px] bg-[rgba(200,50,30,0.52)]" />
          <span className="h-2 w-2 rounded-[1px] bg-[rgba(200,50,30,0.76)]" />
          <span className="h-2 w-2 rounded-[1px] bg-[var(--seal)]" />
          <span>多</span>
        </div>
      </div>

      {/* Tag distribution card */}
      <div className="card p-4">
        <h3 className="text-[9px] uppercase tracking-[0.2em] text-wall-dim">
          标签分布
        </h3>
        <div className="mt-3 space-y-2">
          {DO_TAGS.map((t) => (
            <div key={t.tag} className="space-y-0.5 group cursor-default">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-wall-ink group-hover:text-white transition-colors">
                  {t.tag}
                </span>
                <span className="text-wall-dim tabular-nums">
                  {t.count} 张卡
                </span>
              </div>
              <div
                className="h-1 w-full overflow-hidden rounded bg-white/[0.06]"
                aria-hidden
              >
                <div
                  className="h-full rounded bg-[var(--seal)] transition-all duration-700 group-hover:brightness-125"
                  style={{ width: `${t.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
