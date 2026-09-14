"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  oauth: boolean;
  demo: boolean;
  error?: string | null;
}

export function Welcome({ oauth, demo, error }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function enterDemo() {
    setBusy(true);
    setLocalError(null);
    try {
      const r = await fetch("/api/auth/demo", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "进入体验模式失败。");
      router.push("/plan");
      router.refresh();
    } catch (e) {
      setLocalError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center gap-3">
        <span className="brush text-2xl leading-none text-white">知行</span>
        <span className="text-xs tracking-[0.2em] text-wall-dim">无行动，不知乎</span>
      </header>

      <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_minmax(320px,420px)]">
        <div className="max-w-xl">
          <p className="eyebrow !text-wall-dim">知乎黑客松 2026 · Agent 在社区中的新角色</p>
          <h1 className="song mt-4 text-[34px] font-semibold leading-[1.25] text-white sm:text-[44px]">
            你收藏过的每一条干货，
            <br />
            都欠自己两分钟。
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-wall-ink/85">
            知行读你的知乎收藏夹，把真正能做的那部分，变成每天三个两分钟内就能完成的小动作。
            做完了，顺手告诉作者一声。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {oauth && (
              <a className="btn btn-seal" href="/api/auth/login">
                用知乎账号登录
              </a>
            )}
            {demo && (
              <button type="button" className={`btn ${oauth ? "btn-ghost" : "btn-seal"}`} onClick={enterDemo} disabled={busy}>
                {busy ? "正在进入…" : oauth ? "不登录，先看示例" : "进入体验模式"}
              </button>
            )}
            {!oauth && !demo && <p className="text-sm text-wall-dim">服务端还没有配置知乎凭证。</p>}
          </div>
          {(error || localError) && <p className="mt-4 text-sm text-[#e8897a]">{error || localError}</p>}
          {demo && (
            <p className="mt-3 max-w-md text-xs leading-relaxed text-wall-dim">
              体验模式使用项目作者的公开收藏夹作为示例数据，不会读取你的账号。
              {oauth ? "用知乎登录后，读取的才是你自己的收藏。" : ""}
            </p>
          )}

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 text-xs text-wall-dim">
            <div>
              <dt className="text-white/80">读</dt>
              <dd className="mt-1 leading-relaxed">只读标题与摘要，不碰你的私信和全文。</dd>
            </div>
            <div>
              <dt className="text-white/80">拣</dt>
              <dd className="mt-1 leading-relaxed">故事、情绪、争论会被诚实地放过，不硬转成任务。</dd>
            </div>
            <div>
              <dt className="text-white/80">还</dt>
              <dd className="mt-1 leading-relaxed">做完的行动可以一句话还给作者，让好内容知道自己被用过。</dd>
            </div>
          </dl>
        </div>

        <div className="hidden lg:block" aria-hidden>
          <div className="leaf mx-auto w-[360px] rotate-[1.5deg]">
            <div className="leaf-holes">
              <i />
              <i />
            </div>
            <div className="px-7 pt-3 pb-4">
              <p className="eyebrow">9 月 · 星期一</p>
              <div className="date-num">14</div>
            </div>
            <div className="leaf-rule double mx-7" />
            <div className="px-7 pt-4">
              <div className="flex items-start gap-4">
                <span className="mark">宜</span>
                <div className="flex-1 pt-1">
                  <div className="act !py-3">
                    <span className="box mt-0.5 block" />
                    <div>
                      <p className="act-title !text-[16px]">
                        <span>闭眼坐一分钟，只数呼吸</span>
                      </p>
                      <p className="act-source !text-[12px]">作者说正念要从最简单的开始 · 寒偌灵 的回答</p>
                    </div>
                  </div>
                  <div className="act done !py-3">
                    <span className="box mt-0.5 block border-seal-2 after:content-none" style={{ borderColor: "var(--seal-2)" }} />
                    <div>
                      <p className="act-title !text-[16px]">
                        <span>把明天要说的三句话写在便签上</span>
                      </p>
                      <p className="act-source !text-[12px]">作者说表达先从「是什么、为什么、怎么办」开始 · 学以安身 的回答</p>
                    </div>
                    <span className="stamp">行</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="leaf-rule mx-7 mt-3" />
            <div className="flex items-center gap-4 px-7 py-4">
              <span className="mark taboo">忌</span>
              <p className="song text-[14px] text-ink-2">再收藏一篇不看</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="text-[11px] text-wall-dim">数据来自知乎开放平台 · 知行只读取你授权范围内的收藏标题与摘要</footer>
    </main>
  );
}
