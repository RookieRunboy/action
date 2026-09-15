"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { FriendPeek as PeekView } from "@/lib/friends";

interface Props {
  name: string;
  handle: string;
  headline?: string;
  peek: PeekView;
  canAdopt: boolean;
  adoptedIds: Set<string>;
  onAdopt: (id: string) => void;
  onClose: () => void;
}

export function FriendPeek({
  name,
  handle,
  headline,
  peek,
  canAdopt,
  adoptedIds,
  onAdopt,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const empty = !canAdopt && peek.habits.length === 0 && peek.knowledge.length === 0;

  return (
    <div className="peek-mask" onClick={onClose}>
      <div
        className="peek"
        role="dialog"
        aria-modal="true"
        aria-labelledby="peek-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="peek-title">{name}</h2>
        <span className="peek-handle">{handle}</span>
        {headline ? <p className="peek-head">{headline}</p> : null}
        <button type="button" className="btn btn-text" onClick={onClose}>
          关闭
        </button>
        {empty ? (
          <p className="peek-empty">
            还没有在练的习惯或知识点。
            <Link href="/plan">去筹划页挑几张</Link>
          </p>
        ) : (
          <>
            <div className="peek-block">
              <h3>在执行的习惯</h3>
              {peek.habits.map((item) => (
                <div key={item.id} className="peek-item">
                  {item.text}
                </div>
              ))}
              {peek.remainingHabits > 0 && <p className="peek-more">还有 {peek.remainingHabits} 项</p>}
            </div>
            <div className="peek-block">
              <h3>在复习的知识点</h3>
              {peek.knowledge.map((item) => (
                <div key={item.id} className="peek-item">
                  {item.text}
                  {item.sourceUrl ? (
                    <a
                      className="peek-src"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="原文"
                    >
                      ↗
                    </a>
                  ) : null}
                  {canAdopt ? (
                    adoptedIds.has(item.id) ? (
                      <button type="button" className="btn btn-ink" disabled>
                        已在知行
                      </button>
                    ) : (
                      <button type="button" className="btn btn-ink" onClick={() => onAdopt(item.id)}>
                        加入我的知行
                      </button>
                    )
                  ) : null}
                </div>
              ))}
              {peek.remainingKnowledge > 0 && <p className="peek-more">还有 {peek.remainingKnowledge} 项</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
