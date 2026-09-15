/**
 * Mock preview of the Today (今日) page for landing page DailyAction section.
 * Shows a mini Leaf calendar with to-do actions, a flash card, and stats shelf.
 */
import React from "react";

const ACTIONS = [
  {
    text: "闭眼坐一分钟，只数呼吸",
    source: "作者说正念要从最简单的开始 · 寒偌灵 的回答",
    done: true,
    tags: ["正念"],
  },
  {
    text: "找一段 5 分钟跟练视频做一次",
    source: "零基础运动入门 · KnowYourself 的回答",
    done: true,
    tags: ["运动"],
  },
  {
    text: "睡前写三件今天感恩的小事",
    source: "心理学家推荐的睡前仪式 · 寒偌灵 的回答",
    done: false,
    tags: ["心理"],
  },
];

export function MockLeafPreview() {
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* The leaf */}
      <article className="leaf">
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
              {ACTIONS.map((a, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[20px_1fr] gap-2.5 py-2.5 border-b border-dashed border-[var(--rule)] last:border-b-0 ${a.done ? "opacity-75" : ""}`}
                >
                  <span
                    className={`box !w-[18px] !h-[18px] !mt-0.5 block ${a.done ? "!border-[var(--seal-2)]" : ""}`}
                    style={
                      a.done
                        ? {
                            position: "relative",
                          }
                        : undefined
                    }
                  >
                    {a.done && (
                      <span
                        className="absolute"
                        style={{
                          left: "5px",
                          top: "1px",
                          width: "5px",
                          height: "10px",
                          border: "solid var(--seal)",
                          borderWidth: "0 2px 2px 0",
                          transform: "rotate(45deg)",
                        }}
                      />
                    )}
                  </span>
                  <div>
                    <p
                      className={`song font-semibold text-[14px] leading-snug ${a.done ? "text-ink-3" : "text-ink"}`}
                    >
                      <span
                        style={
                          a.done
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
                </div>
              ))}
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
              <div className="flash !rotate-0 !p-3 !text-[13px]">
                <span className="flash-progress !text-[9px] !right-3 !top-2">
                  1 / 2
                </span>
                <p className="flash-front !text-[14px] !pr-8">
                  费曼技巧的四个步骤是什么？
                </p>
                <div className="flash-actions !mt-2 !gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ink !text-[11px] !px-2.5 !py-1"
                  >
                    翻面
                  </button>
                  <span className="self-center text-[9px] text-ink-3">
                    空格翻面
                  </span>
                </div>
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
            <span>宜 2 / 3 · 记 0 / 2</span>
          </div>
          {/* Stamp - 知行合一 */}
          <span
            className="absolute right-4 bottom-3 w-16 h-16 grid place-items-center text-[var(--seal-ink)] border-[3px] border-[var(--seal-ink)] rounded-[8px] mix-blend-multiply pointer-events-none opacity-70"
            style={{
              fontFamily: "var(--font-brush)",
              fontSize: "24px",
              letterSpacing: "0.06em",
              writingMode: "vertical-rl",
              transform: "rotate(-12deg)",
              maskImage:
                "radial-gradient(circle at 30% 40%, #000 55%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.55) 100%)",
              padding: "4px",
            }}
            aria-hidden
          >
            知行合一
          </span>
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
