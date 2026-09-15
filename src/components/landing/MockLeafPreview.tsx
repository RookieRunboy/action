"use client";

/**
 * Interactive mock preview of the Today (今日) page for landing page.
 * Checkboxes toggle strikethrough + stamp; flash card flips on click.
 */
import React, { useState } from "react";

const INITIAL_ACTIONS = [
  {
    id: "a1",
    text: "闭眼坐一分钟，只数呼吸",
    source: "作者说正念要从最简单的开始 · 寒偌灵 的回答",
    tags: ["正念"],
  },
  {
    id: "a2",
    text: "找一段 5 分钟跟练视频做一次",
    source: "零基础运动入门 · KnowYourself 的回答",
    tags: ["运动"],
  },
  {
    id: "a3",
    text: "睡前写三件今天感恩的小事",
    source: "心理学家推荐的睡前仪式 · 寒偌灵 的回答",
    tags: ["心理"],
  },
];

export function MockLeafPreview() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [flipped, setFlipped] = useState(false);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const actionDone = INITIAL_ACTIONS.filter((a) => done.has(a.id)).length;
  const allDone = actionDone === INITIAL_ACTIONS.length && flipped;

  return (
    <div className="relative w-full max-w-md mx-auto">
      <article className="leaf select-none">
        <div className="leaf-holes" aria-hidden>
          <i />
          <i />
        </div>
        <header className="px-5 pt-3 pb-3 sm:px-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow !text-[10px]">9 月 · 星期一</p>
              <div className="date-num !text-[72px]">15</div>
            </div>
            <div className="text-right pb-2">
              <p className="brush text-[20px] leading-none text-ink">知行</p>
              <p className="song mt-0.5 text-[10px] tracking-[0.18em] text-ink-3">
                无行动，不知乎
              </p>
            </div>
          </div>
        </header>
        <div className="leaf-rule double mx-5 sm:mx-7" />

        {/* 宜 section */}
        <section className="px-5 pt-4 sm:px-7">
          <div className="flex items-start gap-3">
            <span
              className="mark !w-[32px] !h-[32px] !text-[22px] !border-[1.2px]"
              aria-label="宜"
            >
              宜
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              {INITIAL_ACTIONS.map((a) => {
                const isDone = done.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`relative grid grid-cols-[20px_1fr] gap-2.5 py-2.5 border-b border-dashed border-[var(--rule)] last:border-b-0 transition-opacity duration-300 ${isDone ? "opacity-75" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggle(a.id)}
                      className="box !w-[18px] !h-[18px] !mt-0.5 cursor-pointer"
                      aria-label={`做了：${a.text}`}
                    />
                    <div>
                      <p
                        className={`song font-semibold text-[14px] leading-snug transition-colors duration-300 ${isDone ? "text-ink-3" : "text-ink"}`}
                      >
                        <span
                          style={
                            isDone
                              ? {
                                  backgroundImage:
                                    "linear-gradient(var(--seal), var(--seal))",
                                  backgroundRepeat: "no-repeat",
                                  backgroundSize: "100% 1.5px",
                                  backgroundPosition: "0 58%",
                                }
                              : undefined
                          }
                        >
                          {a.text}
                        </span>
                      </p>
                      <p className="text-[10px] text-ink-2 mt-0.5 leading-relaxed">
                        {a.source}
                      </p>
                    </div>
                    {/* Mini stamp per action */}
                    {isDone && (
                      <span
                        className="stamp !w-[36px] !h-[36px] !text-[28px] !right-0 !top-2 !border-[2px] !rounded-[6px]"
                        aria-hidden
                      >
                        行
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 记 section - Flash card */}
        <div className="leaf-rule mx-5 mt-2 sm:mx-7" />
        <section className="px-5 pt-4 sm:px-7">
          <div className="flex items-start gap-3">
            <span
              className="mark !w-[32px] !h-[32px] !text-[22px] !border-[1.2px]"
              aria-label="记"
            >
              记
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div
                className="flash !rotate-0 !p-3 !text-[13px] cursor-pointer transition-all duration-300"
                onClick={() => setFlipped(!flipped)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setFlipped(!flipped);
                  }
                }}
              >
                <span className="flash-progress !text-[9px] !right-3 !top-2">
                  1 / 2
                </span>
                {!flipped ? (
                  <>
                    <p className="flash-front !text-[14px] !pr-8">
                      费曼技巧的四个步骤是什么？
                    </p>
                    <div className="flash-actions !mt-2 !gap-1.5">
                      <span className="btn btn-ink !text-[11px] !px-2.5 !py-1 pointer-events-none">
                        点击翻面
                      </span>
                      <span className="self-center text-[9px] text-ink-3">
                        试试看 →
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-ink-3">
                      费曼技巧的四个步骤是什么？
                    </p>
                    <p className="flash-back mt-1.5 !text-[13px]">
                      ① 选一个概念 → ② 用大白话教别人 → ③ 找到卡壳的地方回去学
                      → ④ 简化再教一遍
                    </p>
                    <blockquote className="quote !mt-1.5 !text-[11px] !pl-2.5">
                      「如果你不能简单地解释它，你就还没有真正理解它」
                    </blockquote>
                    <div className="flash-actions !mt-2 !gap-1.5">
                      <span className="btn btn-solid-ink !text-[11px] !px-2.5 !py-1 pointer-events-none">
                        记得
                      </span>
                      <span className="btn btn-ink !text-[11px] !px-2.5 !py-1 pointer-events-none">
                        模糊
                      </span>
                      <span className="btn btn-ink !text-[11px] !px-2.5 !py-1 pointer-events-none">
                        忘了
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 忌 section */}
        <div className="leaf-rule mx-5 mt-2 sm:mx-7" />
        <section className="px-5 py-3 sm:px-7">
          <div className="flex items-center gap-3">
            <span
              className="mark taboo !w-[32px] !h-[32px] !text-[22px] !border-[1.2px]"
              aria-label="忌"
            >
              忌
            </span>
            <p className="song text-[12px] text-ink-2">再收藏一篇不看</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative px-5 pb-5 pt-1 sm:px-7">
          <div className="leaf-rule mb-2" />
          <div className="flex items-center justify-between text-[10px] text-ink-3 tabular-nums">
            <span>
              宜 {actionDone} / {INITIAL_ACTIONS.length} · 记{" "}
              {flipped ? 1 : 0} / 2
            </span>
          </div>
          {/* Big stamp - 知行合一 */}
          {allDone && (
            <span
              className="stamp big"
              aria-hidden
            >
              知行合一
            </span>
          )}
        </footer>
      </article>

      {/* Side shelf */}
      <div className="card absolute -right-4 top-4 w-36 p-3 rotate-[2deg] shadow-lg hidden lg:block">
        <div className="flex items-baseline justify-between">
          <p className="text-[9px] uppercase tracking-[0.2em] text-wall-dim">
            连续天数
          </p>
          <p className="text-[9px] text-wall-dim">保持住</p>
        </div>
        <p
          className="mt-0.5 text-white font-black"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "40px",
            lineHeight: "0.9",
          }}
        >
          7
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
          <div>
            <dt className="text-wall-dim">已内化</dt>
            <dd className="mt-0.5 text-sm font-medium text-white tabular-nums">
              3
            </dd>
          </div>
          <div>
            <dt className="text-wall-dim">在练</dt>
            <dd className="mt-0.5 text-sm font-medium text-white tabular-nums">
              8
            </dd>
          </div>
          <div>
            <dt className="text-wall-dim">待开始</dt>
            <dd className="mt-0.5 text-sm font-medium text-white tabular-nums">
              9
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
