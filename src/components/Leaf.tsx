"use client";

import type { PlanResponse } from "@/lib/types";
import type { DoneRecord } from "@/lib/store";
import { leafParts } from "@/lib/dates";
import { TABOOS } from "@/lib/prompts";
import { ActionRow } from "./ActionRow";

interface Props {
  date: string;
  plan: PlanResponse | null;
  loading: boolean;
  error: string | null;
  doneMap: Record<string, DoneRecord>;
  onToggle: (id: string, checked: boolean) => void;
  onReplied: (id: string) => void;
  onSwap: (id: string) => void;
  onRetry: () => void;
}

function tabooFor(date: string) {
  const n = date.split("-").reduce((a, b) => a + Number(b), 0);
  return TABOOS[n % TABOOS.length];
}

export function Leaf({ date, plan, loading, error, doneMap, onToggle, onReplied, onSwap, onRetry }: Props) {
  const { month, day, weekday } = leafParts(date);
  const today = plan?.today || [];
  const doneCount = today.filter((t) => doneMap[t.id]).length;
  const allDone = today.length > 0 && doneCount === today.length;

  return (
    <article className="leaf" aria-live="polite">
      <div className="leaf-holes" aria-hidden>
        <i />
        <i />
      </div>

      <header className="px-7 pt-4 pb-5 sm:px-9">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">
              {month} 月 · {weekday}
            </p>
            <div className="date-num">{String(day).padStart(2, "0")}</div>
          </div>
          <div className="text-right pb-2">
            <p className="brush text-[26px] leading-none text-ink">知行</p>
            <p className="song mt-1 text-[12px] tracking-[0.18em] text-ink-3">无行动，不知乎</p>
          </div>
        </div>
      </header>

      <div className="leaf-rule double mx-7 sm:mx-9" />

      <section className="px-7 pt-5 sm:px-9">
        <div className="flex items-start gap-4">
          <span className="mark" aria-label="宜">
            宜
          </span>
          <div className="min-w-0 flex-1 pt-1">
            {loading && (
              <div className="space-y-6 py-1" aria-label="正在生成今日行动">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="grid grid-cols-[28px_1fr] gap-3.5">
                    <div className="shimmer mt-1 h-6 w-6" />
                    <div className="space-y-2">
                      <div className="shimmer h-5 w-[78%]" />
                      <div className="shimmer h-3.5 w-[92%]" />
                      <div className="shimmer h-3.5 w-[60%]" />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink-3">正在读你的收藏夹，分拣哪些能做、哪些该放过……大约 20 秒。</p>
              </div>
            )}

            {!loading && error && (
              <div className="py-2">
                <p className="song text-[15px] text-ink">{error}</p>
                <button type="button" className="btn btn-ink mt-3" onClick={onRetry}>
                  再试一次
                </button>
              </div>
            )}

            {!loading && !error && plan && today.length === 0 && (
              <div className="py-2">
                <p className="song text-[15px] text-ink">
                  这个收藏夹里 {plan.counts.total} 条内容，暂时没有能变成行动的。
                </p>
                <p className="mt-1 text-sm text-ink-2">换一个收藏夹试试，或者先去知乎收藏几篇真正想做的。</p>
              </div>
            )}

            {!loading && !error && today.length > 0 && (
              <div>
                {today.map((item) => (
                  <ActionRow
                    key={item.id}
                    item={item}
                    done={doneMap[item.id]}
                    onToggle={onToggle}
                    onReplied={onReplied}
                    onSwap={plan && plan.spares.length > 0 ? onSwap : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="leaf-rule mx-7 mt-3 sm:mx-9" />

      <section className="px-7 py-4 sm:px-9">
        <div className="flex items-center gap-4">
          <span className="mark taboo" aria-label="忌">
            忌
          </span>
          <p className="song text-[15px] text-ink-2">{tabooFor(date)}</p>
        </div>
      </section>

      <footer className="relative px-7 pb-7 pt-1 sm:px-9">
        <div className="leaf-rule mb-3" />
        <div className="flex items-center justify-between text-[12px] text-ink-3">
          <span>
            {plan ? `来自「${plan.folder}」` : " "}
            {plan && plan.counts.total > 0 && ` · ${plan.counts.total} 条里挑出 ${plan.counts.action} 条能做的`}
          </span>
          <span className="tabular-nums">
            {today.length > 0 ? `${doneCount} / ${today.length}` : ""}
          </span>
        </div>
        {allDone && (
          <span className="stamp big" aria-label="今日知行合一">
            知行合一
          </span>
        )}
      </footer>
    </article>
  );
}
