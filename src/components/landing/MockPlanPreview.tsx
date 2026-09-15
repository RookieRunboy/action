"use client";

/**
 * Interactive mock preview of the Plan (筹划) page for landing page.
 * Tags toggle filter; × dismisses cards with fade-out animation.
 */
import React, { useState } from "react";

const ALL_CANDIDATES = [
  {
    id: "c1",
    kind: "action" as const,
    text: "找一段 5 分钟的跟练视频做一次",
    tags: ["运动"],
    author: "KnowYourself",
    type: "回答",
    reason: "答主给了具体的入门跟练推荐",
  },
  {
    id: "c2",
    kind: "flash" as const,
    text: "费曼技巧的四个步骤是什么？",
    tags: ["学习方法"],
    author: "远方青木",
    type: "文章",
    reason: "可提取为自测闪卡",
  },
  {
    id: "c3",
    kind: "action" as const,
    text: "睡前写三件今天感恩的小事",
    tags: ["心理"],
    author: "寒偌灵",
    type: "回答",
    reason: "两分钟内可完成的睡前习惯",
  },
  {
    id: "c4",
    kind: "flash" as const,
    text: "番茄工作法的标准时间分配？",
    tags: ["学习方法"],
    author: "刘未鹏",
    type: "文章",
    reason: "核心知识点适合自测",
  },
  {
    id: "c5",
    kind: "action" as const,
    text: "早上起来喝一杯温水",
    tags: ["健康"],
    author: "丁香医生",
    type: "回答",
    reason: "最简单的每日健康习惯",
  },
];

const ALL_TAGS = ["运动", "心理", "学习方法", "健康"];

export function MockPlanPreview() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [fading, setFading] = useState<Set<string>>(new Set());
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const dismiss = (id: string) => {
    setFading((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setFading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDismissed((prev) => new Set(prev).add(id));
    }, 350);
  };

  const visible = ALL_CANDIDATES.filter(
    (c) =>
      !dismissed.has(c.id) &&
      (activeTag === null || c.tags.includes(activeTag)),
  );

  // Tags that still have visible candidates
  const liveTags = ALL_TAGS.filter((t) =>
    ALL_CANDIDATES.some((c) => !dismissed.has(c.id) && c.tags.includes(t)),
  );

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="leaf px-5 py-4 sm:px-6 text-[13px]">
        <p className="eyebrow !text-[10px]">筹划</p>
        <p className="song mt-0.5 text-[15px] font-semibold text-ink">
          从收藏里挑出想养成的
        </p>

        {/* Tags */}
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {liveTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip-btn !text-[10px] !px-2 !py-0.5 ${activeTag === t ? "on" : ""}`}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Candidate rows */}
        <div className="mt-2">
          {visible.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[16px_24px_1fr] gap-2 py-2.5 border-b border-dashed border-[var(--rule)] last:border-b-0 items-start transition-all duration-300"
              style={{
                opacity: fading.has(c.id) ? 0 : 1,
                transform: fading.has(c.id) ? "translateX(-20px)" : "none",
                maxHeight: fading.has(c.id) ? "0px" : "200px",
              }}
            >
              <button
                type="button"
                className="text-ink-3 text-[14px] leading-none mt-0.5 cursor-pointer hover:text-[var(--seal)] transition-colors border-none bg-transparent p-0"
                onClick={() => dismiss(c.id)}
                aria-label={`删除：${c.text}`}
              >
                ×
              </button>
              <span
                className={`text-[14px] leading-none w-6 h-6 grid place-items-center border border-current rounded ${c.kind === "flash" ? "text-[var(--link)] border-[var(--link)]" : "text-ink border-ink"}`}
                style={{ fontFamily: "var(--font-brush)" }}
              >
                {c.kind === "action" ? "做" : "记"}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="song font-semibold text-[13px] text-ink leading-snug">
                    {c.text}
                  </span>
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="chip !text-[9px] !px-1.5 !py-0 !leading-relaxed"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-ink-2 mt-0.5">
                  <span className="text-[var(--link)] underline underline-offset-2 decoration-[rgba(45,79,124,0.35)]">
                    {c.author} 的{c.type}
                  </span>
                  <span className="text-ink-3"> · {c.reason}</span>
                </p>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="py-4 text-[12px] text-ink-3 song text-center">
              {dismissed.size > 0
                ? "不顺眼的都删了。试试重新选个标签？"
                : "没有匹配的卡片。"}
            </p>
          )}
        </div>

        {/* Skipped section */}
        <div className="mt-3 border-t border-dashed border-[var(--rule)] pt-2.5">
          <div className="flex items-baseline justify-between">
            <span className="song text-[12px] text-ink">
              放过的 <span className="tabular-nums text-ink-3">2</span>
            </span>
            <span className="text-[10px] text-ink-3">展开</span>
          </div>
          <p className="text-[10px] text-ink-3 mt-0.5">
            故事、情绪、争论。不会硬把它们变成任务。
          </p>
        </div>
      </div>

      {/* Side card */}
      <div className="card absolute -right-4 top-6 w-36 p-3 rotate-[2deg] shadow-lg hidden lg:block">
        <p className="text-[9px] uppercase tracking-[0.2em] text-wall-dim">
          收藏夹体检
        </p>
        <div className="bar mt-2 !h-[6px]" aria-hidden>
          <i style={{ width: "38%", background: "var(--seal)" }} />
          <i style={{ width: "24%", background: "#5f7fa8" }} />
          <i
            style={{
              width: "38%",
              background: "rgba(255,255,255,0.14)",
            }}
          />
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
          <div>
            <dt className="text-wall-dim">能做的</dt>
            <dd className="mt-0.5 text-sm font-medium text-white tabular-nums">
              12
            </dd>
          </div>
          <div>
            <dt className="text-wall-dim">值得记的</dt>
            <dd className="mt-0.5 text-sm font-medium text-white tabular-nums">
              8
            </dd>
          </div>
          <div>
            <dt className="text-wall-dim">放过的</dt>
            <dd className="mt-0.5 text-sm font-medium text-white tabular-nums">
              12
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
