"use client";

import type { ReviewTags } from "@/lib/stats";

interface Props {
  tags: ReviewTags;
}

export function StatsTags({ tags }: Props) {
  const maxDo = Math.max(1, ...tags.do.map((t) => t.count));
  const maxTrain = Math.max(1, ...tags.train.map((t) => t.count));

  const renderList = (items: { tag: string; count: number }[], max: number, emptyText: string) => {
    if (items.length === 0) {
      return <p className="py-2 text-xs text-wall-dim">{emptyText}</p>;
    }
    return (
      <div className="space-y-2.5">
        {items.map((item) => {
          const pct = Math.round((item.count / max) * 100);
          return (
            <div key={item.tag} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-wall-ink">{item.tag}</span>
                <span className="text-wall-dim tabular-nums">{item.count} 张卡</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-white/[0.06]" aria-hidden>
                <div
                  className="h-full rounded bg-[var(--seal)] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="card p-6" aria-label="标签沉淀">
      <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">标签分布</p>
      <p className="mt-1 text-xs text-wall-dim">统计包含有效打卡记录的独立卡片数</p>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded border border-white/[0.04] bg-white/[0.01] p-4">
          <p className="mb-3 text-xs font-semibold text-white">做什么 · Do</p>
          {renderList(tags.do, maxDo, "暂无行动标签打卡数据")}
        </div>
        <div className="rounded border border-white/[0.04] bg-white/[0.01] p-4">
          <p className="mb-3 text-xs font-semibold text-white">练什么 · Train</p>
          {renderList(tags.train, maxTrain, "暂无心智标签打卡数据")}
        </div>
      </div>
    </section>
  );
}
