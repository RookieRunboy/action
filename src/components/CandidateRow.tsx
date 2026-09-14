"use client";

import type { Card, CardState } from "@/lib/types";

interface Props {
  card: Card;
  checked: boolean;
  state?: CardState;
  onToggle: (id: string, checked: boolean) => void;
}

const TYPE_LABEL: Record<string, string> = { answer: "回答", article: "文章", zvideo: "视频", pin: "想法", question: "问题" };

function statusWord(s?: CardState): string {
  if (!s) return "";
  if (s.status === "queued") return "待开始";
  if (s.status === "active") return `在练 · 第 ${s.box} 格`;
  if (s.status === "internalized") return "已内化";
  return "";
}

export function CandidateRow({ card, checked, state, onToggle }: Props) {
  const inputId = `cand-${card.id}`;
  const locked = state?.status === "internalized";
  const text = card.kind === "action" ? card.action : card.front;
  const author = card.source.author?.name;
  return (
    <div className={`cand ${checked ? "" : "off"}`}>
      <input
        id={inputId}
        type="checkbox"
        className="box !mt-1"
        checked={checked}
        disabled={locked}
        onChange={(e) => onToggle(card.id, e.target.checked)}
        aria-label={`${checked ? "取消" : "加入"}：${text}`}
      />
      <span className={`kind-glyph ${card.kind}`} aria-label={card.kind === "action" ? "行动卡" : "闪卡"}>
        {card.kind === "action" ? "做" : "记"}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <label htmlFor={inputId} className="cand-text cursor-pointer">{text}</label>
          {card.tags.do.map((t) => <span key={t} className="chip">{t}</span>)}
          {card.tags.train.map((t) => <span key={t} className="chip train">{t}</span>)}
          {state && <span className="status-word ml-auto">{statusWord(state)}</span>}
        </div>
        <p className="cand-meta">
          <a href={card.source.url} target="_blank" rel="noopener noreferrer">
            {author ? `${author} 的${TYPE_LABEL[card.source.contentType] || "内容"}` : card.source.title}
          </a>
          {card.reason && <span className="text-ink-3"> · {card.reason}</span>}
        </p>
      </div>
    </div>
  );
}
