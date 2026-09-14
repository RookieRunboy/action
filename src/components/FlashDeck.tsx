"use client";

import { useEffect, useState } from "react";
import type { CardState, FlashCard, Result } from "@/lib/types";
import { resultOn } from "@/lib/schedule";

interface Props {
  cards: FlashCard[];
  states: Record<string, CardState>;
  date: string;
  onResult: (id: string, result: Result) => void;
}

export function FlashDeck({ cards, states, date, onResult }: Props) {
  const pending = cards.filter((c) => !resultOn(states[c.id], date));
  const current = pending[0];
  const [flipped, setFlipped] = useState(false);
  const total = cards.length;
  const doneCount = total - pending.length;

  useEffect(() => setFlipped(false), [current?.id]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3"].includes(e.key)) {
        onResult(current.id, (["remembered", "vague", "forgot"] as Result[])[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, flipped, onResult]);

  if (total === 0) return <p className="song py-2 text-[15px] text-ink-2">今天没有要复习的。</p>;

  if (!current) {
    const tally = { remembered: 0, vague: 0, forgot: 0 } as Record<string, number>;
    cards.forEach((c) => {
      const r = resultOn(states[c.id], date);
      if (r && r in tally) tally[r]++;
    });
    return (
      <p className="song py-2 text-[15px] text-ink">
        今日闪卡完成 · 记得 {tally.remembered} · 模糊 {tally.vague} · 忘了 {tally.forgot}
      </p>
    );
  }

  const author = current.source.author?.name;
  return (
    <div className="flash" aria-live="polite">
      <span className="flash-progress">{doneCount + 1} / {total}</span>
      {!flipped ? (
        <>
          <p className="flash-front">{current.front}</p>
          <div className="flash-actions">
            <button type="button" className="btn btn-ink" onClick={() => setFlipped(true)} aria-keyshortcuts="Space">翻面</button>
            <span className="self-center text-xs text-ink-3">空格翻面</span>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-ink-3">{current.front}</p>
          <p className="flash-back mt-2">{current.back}</p>
          {current.sourceQuote && <blockquote className="quote">「{current.sourceQuote}」</blockquote>}
          <p className="mt-2 text-xs text-ink-2">
            <a href={current.source.url} target="_blank" rel="noopener noreferrer" className="text-[var(--link)] underline underline-offset-2">
              {author ? `${author} 的原文` : current.source.title}
            </a>
            {current.tags.do.map((t) => <span key={t} className="chip ml-2">{t}</span>)}
            {current.tags.train.map((t) => <span key={t} className="chip train ml-1">{t}</span>)}
          </p>
          <div className="flash-actions">
            <button type="button" className="btn btn-solid-ink" onClick={() => onResult(current.id, "remembered")} aria-keyshortcuts="1">记得</button>
            <button type="button" className="btn btn-ink" onClick={() => onResult(current.id, "vague")} aria-keyshortcuts="2">模糊</button>
            <button type="button" className="btn btn-ink" onClick={() => onResult(current.id, "forgot")} aria-keyshortcuts="3">忘了</button>
            <span className="self-center text-xs text-ink-3">1 / 2 / 3</span>
          </div>
        </>
      )}
    </div>
  );
}
