"use client";

/**
 * Interactive mock preview of the Friends (好友) page for landing page.
 * Click "加入我的知行" → changes to "已在知行" (disabled).
 */
import React, { useState } from "react";

const KANSHAN_HABITS = [
  "闭眼坐两分钟，只数呼吸",
  "走神时微笑，从一重新数",
  "起床后先看到冥想再坐下",
];

const KANSHAN_KNOWLEDGE = [
  { id: "k1", front: "冥想入门最短从多久开始？" },
  { id: "k2", front: "数呼吸时一呼一吸怎么数？" },
  { id: "k3", front: "走神了该怎么办？" },
  { id: "k4", front: "初学冥想必须纠结坐垫吗？" },
];

export function MockFriendsPreview() {
  const [adopted, setAdopted] = useState<Set<string>>(new Set(["k1"]));
  const [justAdopted, setJustAdopted] = useState<Set<string>>(new Set());

  const adopt = (id: string) => {
    setAdopted((prev) => new Set(prev).add(id));
    setJustAdopted((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setJustAdopted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 800);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Friend list */}
      <div className="space-y-2">
        {/* Kanshan row */}
        <div
          className="w-full text-left rounded bg-[var(--paper)] text-[var(--ink)] p-3.5"
          style={{
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.5) inset, 0 2px 3px rgba(0,0,0,0.25)",
          }}
        >
          <div className="flex items-baseline gap-2">
            <span className="song text-[16px] font-semibold">看山</span>
            <span className="text-[11px] text-ink-3">kanshan</span>
          </div>
          <p className="text-[12px] text-ink-2 mt-1">
            冥想入门最短从多久开始？
          </p>
        </div>

        {/* Me row */}
        <div
          className="w-full text-left rounded bg-[var(--paper)] text-[var(--ink)] p-3.5 opacity-60"
          style={{
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.5) inset, 0 2px 3px rgba(0,0,0,0.25)",
          }}
        >
          <div className="flex items-baseline gap-2">
            <span className="song text-[16px] font-semibold">我</span>
            <span className="text-[11px] text-ink-3">zhihu_user</span>
          </div>
          <p className="text-[12px] text-ink-2 mt-1">
            费曼技巧的四个步骤是什么？
          </p>
        </div>
      </div>

      {/* Peek card */}
      <div
        className="rounded bg-[var(--paper)] text-[var(--ink)] p-4"
        style={{ boxShadow: "0 24px 48px -24px rgba(0,0,0,.5)" }}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="song text-[17px] font-semibold m-0">看山</h3>
            <span className="text-[10px] text-ink-3">kanshan</span>
          </div>
          <span className="text-[11px] text-ink-3 cursor-default">关闭</span>
        </div>
        <p className="text-[11px] text-ink-2 mt-1.5 mb-3">
          横看成岭侧成峰。值得记住的，做成闪卡给你。
        </p>

        {/* Habits */}
        <div className="mb-3">
          <h4 className="text-[10px] tracking-[0.18em] text-ink-3 font-medium mb-1.5 uppercase">
            在执行的习惯
          </h4>
          {KANSHAN_HABITS.map((h, i) => (
            <div
              key={i}
              className="py-1.5 border-b border-dashed border-[var(--rule)] last:border-b-0 text-[12px] song text-ink"
            >
              {h}
            </div>
          ))}
        </div>

        {/* Knowledge */}
        <div>
          <h4 className="text-[10px] tracking-[0.18em] text-ink-3 font-medium mb-1.5 uppercase">
            在复习的知识点
          </h4>
          {KANSHAN_KNOWLEDGE.map((k) => {
            const isAdopted = adopted.has(k.id);
            const isJust = justAdopted.has(k.id);
            return (
              <div
                key={k.id}
                className="flex items-center gap-2 py-1.5 border-b border-dashed border-[var(--rule)] last:border-b-0 text-[12px]"
              >
                <span className="song text-ink flex-1 min-w-0">{k.front}</span>
                <a
                  className="text-[var(--link)] text-[13px] leading-none shrink-0 cursor-default"
                  aria-label="原文"
                >
                  ↗
                </a>
                {isAdopted ? (
                  <span
                    className={`text-[10px] shrink-0 border rounded px-1.5 py-0.5 transition-all duration-300 ${
                      isJust
                        ? "text-[var(--seal)] border-[var(--seal)] scale-105"
                        : "text-ink-3 border-[var(--rule)] opacity-60"
                    }`}
                  >
                    已在知行
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-[10px] text-ink shrink-0 border border-ink rounded px-1.5 py-0.5 bg-transparent cursor-pointer hover:bg-ink hover:text-[var(--paper)] transition-all duration-200"
                    onClick={() => adopt(k.id)}
                  >
                    加入我的知行
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
