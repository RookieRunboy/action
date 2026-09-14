"use client";

import { useState } from "react";
import type { PlanResponse, SortedItem } from "@/lib/types";

interface Props {
  plan: PlanResponse | null;
  totalDone: number;
  streakDays: number;
}

function Row({ item, right }: { item: SortedItem; right: string }) {
  return (
    <div className="list-row">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="truncate" title={item.title}>
        {item.title}
      </a>
      <span className="tag">{right}</span>
    </div>
  );
}

function Group({ title, hint, items, right, open: initialOpen = false }: { title: string; hint: string; items: SortedItem[]; right: (i: SortedItem) => string; open?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  if (items.length === 0) return null;
  return (
    <div className="card p-4">
      <button type="button" className="flex w-full items-baseline justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          <span className="font-medium text-white">{title}</span>
          <span className="ml-2 tabular-nums text-wall-dim">{items.length}</span>
        </span>
        <span className="text-xs text-wall-dim">{open ? "收起" : "展开"}</span>
      </button>
      <p className="mt-1 text-xs leading-relaxed text-wall-dim">{hint}</p>
      {open && (
        <div className="mt-2 max-h-72 overflow-y-auto pr-1">
          {items.map((i) => (
            <Row key={i.id} item={i} right={right(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Shelf({ plan, totalDone, streakDays }: Props) {
  const c = plan?.counts;
  const pct = (n: number) => (c && c.total ? `${(n / c.total) * 100}%` : "0%");

  return (
    <aside className="space-y-4">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">已完成的行动</p>
          <p className="text-xs text-wall-dim">{streakDays > 0 ? `连续 ${streakDays} 天` : "今天开始"}</p>
        </div>
        <p className="date-num mt-1 !text-[56px] !leading-none text-white">{totalDone}</p>
        <p className="mt-1 text-xs text-wall-dim">每一个都来自你自己收藏过的内容。</p>
      </div>

      {c && c.total > 0 && (
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">收藏夹体检</p>
          <div className="bar mt-3" aria-hidden>
            <i style={{ width: pct(c.action), background: "var(--seal)" }} />
            <i style={{ width: pct(c.knowledge), background: "#5f7fa8" }} />
            <i style={{ width: pct(c.skip), background: "rgba(255,255,255,0.14)" }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-wall-dim">能做的</dt>
              <dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.action}</dd>
            </div>
            <div>
              <dt className="text-wall-dim">值得懂的</dt>
              <dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.knowledge}</dd>
            </div>
            <div>
              <dt className="text-wall-dim">放过的</dt>
              <dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.skip}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-wall-dim">
            {c.skip > c.action
              ? `${c.total} 条里只有 ${c.action} 条能变成动作。收藏得多，不等于学到得多。`
              : `${c.total} 条里有 ${c.action} 条能变成动作，这是个干货密度很高的收藏夹。`}
          </p>
        </div>
      )}

      {plan && (
        <>
          <Group
            title="值得懂的"
            hint="有价值但不是「做」的事，之后会做成复习卡片。"
            items={plan.knowledge}
            right={(i) => i.domain}
          />
          <Group
            title="放过的"
            hint="故事、情绪、争论。我们不会硬把它们变成任务。"
            items={plan.skipped}
            right={(i) => i.reason}
          />
        </>
      )}

      {plan && (
        <p className="px-1 text-[11px] leading-relaxed text-wall-dim">
          分拣与转化：{plan.provider}。收藏数据来自知乎开放平台，仅读取标题与摘要，结果缓存在本地。
        </p>
      )}
    </aside>
  );
}
