"use client";

import { useState } from "react";
import type { TodayAction } from "@/lib/types";
import type { DoneRecord } from "@/lib/store";

interface Props {
  item: TodayAction;
  done?: DoneRecord;
  onToggle: (id: string, checked: boolean) => void;
  onReplied: (id: string) => void;
  onSwap?: (id: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  answer: "回答",
  article: "文章",
  zvideo: "视频",
  pin: "想法",
  question: "问题",
};

export function ActionRow({ item, done, onToggle, onReplied, onSwap }: Props) {
  const [draft, setDraft] = useState(item.replyDraft);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputId = `act-${item.id}`;
  const showReply = !!done && !done.replied && !dismissed;

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopied(true);
    } catch {
      /* 剪贴板不可用时仍然打开原文 */
    }
    window.open(item.url, "_blank", "noopener,noreferrer");
    onReplied(item.id);
  }

  return (
    <div className={`act ${done ? "done" : ""}`}>
      <input
        id={inputId}
        className="box"
        type="checkbox"
        checked={!!done}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        aria-label={`完成：${item.action}`}
      />
      <div className="min-w-0">
        <label htmlFor={inputId} className="act-title block cursor-pointer">
          <span>{item.action}</span>
        </label>
        <p className="act-source">
          {item.why}
          {" · "}
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            {item.author?.name ? `${item.author.name} 的${TYPE_LABEL[item.contentType] || "内容"}` : `原${TYPE_LABEL[item.contentType] || "内容"}`}
          </a>
          <span className="text-ink-3">
            {" · "}
            {item.daysOnShelf === 0 ? "今天刚收藏" : `收藏了 ${item.daysOnShelf} 天`}
          </span>
        </p>
        {item.sourceQuote && <blockquote className="quote">「{item.sourceQuote}」</blockquote>}

        {!done && onSwap && (
          <div className="mt-1 -ml-2">
            <button type="button" className="btn btn-text" onClick={() => onSwap(item.id)}>
              换一条
            </button>
          </div>
        )}

        {showReply && (
          <div className="reply fade-in">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow !text-ink-2">告诉作者你做了</p>
              <button type="button" className="btn btn-text -mr-2" onClick={() => setDismissed(true)}>
                这次不说
              </button>
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="给作者的留言" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ink" onClick={copyAndOpen}>
                复制并去原文留言
              </button>
              <span className="text-xs text-ink-3">
                {copied ? "已复制，到原文评论区粘贴即可。" : "在知乎发出去，作者会知道有人真的照做了。"}
              </span>
            </div>
          </div>
        )}
        {done?.replied && <p className="mt-2 text-xs text-ink-3">已去原文留言 · 感谢你把行动带回了社区</p>}
      </div>
      {done && (
        <span className="stamp" aria-hidden>
          行
        </span>
      )}
    </div>
  );
}
