"use client";

import { useState } from "react";
import type { ActionCard, CardState, Result } from "@/lib/types";
import { resultOn } from "@/lib/schedule";
import { daysOnShelf } from "@/lib/dates";

interface Props {
  card: ActionCard;
  state: CardState;
  date: string;
  onResult: (id: string, result: Result) => void;
}

const TYPE_LABEL: Record<string, string> = { answer: "回答", article: "文章", zvideo: "视频", pin: "想法", question: "问题" };

export function ActionRow({ card, state, date, onResult }: Props) {
  const [draft, setDraft] = useState(card.replyDraft);
  const [dismissed, setDismissed] = useState(false);
  const [replied, setReplied] = useState(false);
  const [copied, setCopied] = useState(false);
  const result = resultOn(state, date);
  const done = result === "did";
  const inputId = `act-${card.id}`;

  if (result === "later") {
    return <div className="later-row">明天再来 · {card.action}</div>;
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopied(true);
    } catch {
      /* 剪贴板不可用时仍打开原文 */
    }
    window.open(card.source.url, "_blank", "noopener,noreferrer");
    setReplied(true);
  }

  const author = card.source.author?.name;
  const shelf = daysOnShelf(card.source.favTime);

  return (
    <div className={`act ${done ? "done" : ""}`}>
      <input
        id={inputId}
        className="box"
        type="checkbox"
        checked={done}
        disabled={done}
        onChange={(e) => e.target.checked && onResult(card.id, "did")}
        aria-label={`做了：${card.action}`}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <label htmlFor={inputId} className="act-title cursor-pointer"><span>{card.action}</span></label>
          {card.tags.do.map((t) => <span key={t} className="chip">{t}</span>)}
          {card.tags.train.map((t) => <span key={t} className="chip train">{t}</span>)}
        </div>
        <p className="act-source">
          {card.why}
          {" · "}
          <a href={card.source.url} target="_blank" rel="noopener noreferrer">
            {author ? `${author} 的${TYPE_LABEL[card.source.contentType] || "内容"}` : `原${TYPE_LABEL[card.source.contentType] || "内容"}`}
          </a>
          <span className="text-ink-3"> · {shelf === 0 ? "今天刚收藏" : `收藏了 ${shelf} 天`}</span>
        </p>
        {card.sourceQuote && <blockquote className="quote">「{card.sourceQuote}」</blockquote>}

        {!done && (
          <div className="mt-1 -ml-2">
            <button type="button" className="btn btn-text" onClick={() => onResult(card.id, "later")}>今天不做</button>
          </div>
        )}

        {done && !replied && !dismissed && (
          <div className="reply fade-in">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow !text-ink-2">告诉作者你做了</p>
              <button type="button" className="btn btn-text -mr-2" onClick={() => setDismissed(true)}>这次不说</button>
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="给作者的留言" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ink" onClick={copyAndOpen}>复制并去原文留言</button>
              <span className="text-xs text-ink-3">{copied ? "已复制，到原文评论区粘贴即可。" : "在知乎发出去，作者会知道有人真的照做了。"}</span>
            </div>
          </div>
        )}
        {done && replied && <p className="mt-2 text-xs text-ink-3">已去原文留言 · 感谢你把行动带回了社区</p>}
      </div>
      {done && <span className="stamp" aria-hidden>行</span>}
    </div>
  );
}
