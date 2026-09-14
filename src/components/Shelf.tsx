"use client";

import Link from "next/link";
import type { FolderScan } from "@/lib/types";

interface Props {
  summary: { internalized: number; active: number; queued: number };
  streakDays: number;
  scan?: FolderScan;
  saveWarn: boolean;
}

export function Shelf({ summary, streakDays, scan, saveWarn }: Props) {
  const c = scan?.counts;
  const pct = (n: number) => (c && c.total ? `${(n / c.total) * 100}%` : "0%");
  return (
    <aside className="space-y-4">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">连续天数</p>
          <p className="text-xs text-wall-dim">{streakDays > 0 ? "保持住" : "今天开始"}</p>
        </div>
        <p className="date-num mt-1 !text-[56px] !leading-none text-white">{streakDays}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-wall-dim">已内化</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{summary.internalized}</dd></div>
          <div><dt className="text-wall-dim">在练</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{summary.active}</dd></div>
          <div><dt className="text-wall-dim">待开始</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{summary.queued}</dd></div>
        </dl>
        {saveWarn && <p className="mt-3 text-[11px] text-[#e8897a]">本浏览器无法保存进度，进度只在本次会话有效。</p>}
      </div>

      {c && c.total > 0 && (
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-wall-dim">收藏体检{scan!.title ? ` · ${scan!.title}` : ""}</p>
          <div className="bar mt-3" aria-hidden>
            <i style={{ width: pct(c.action), background: "var(--seal)" }} />
            <i style={{ width: pct(c.flash), background: "#5f7fa8" }} />
            <i style={{ width: pct(c.skip), background: "rgba(255,255,255,0.14)" }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-wall-dim">能做的</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.action}</dd></div>
            <div><dt className="text-wall-dim">值得记的</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.flash}</dd></div>
            <div><dt className="text-wall-dim">放过的</dt><dd className="mt-0.5 text-base font-medium text-white tabular-nums">{c.skip}</dd></div>
          </dl>
        </div>
      )}

      <Link href="/plan" className="card block p-4 text-sm text-wall-ink hover:text-white">去筹划页挑几张 →</Link>

      <p className="px-1 text-[11px] leading-relaxed text-wall-dim">
        {scan ? `分拣与转化：${scan.provider}。` : ""}收藏在登录时读入一次，进度保存在本浏览器。
      </p>
    </aside>
  );
}
