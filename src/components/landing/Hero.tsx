import React from 'react';

export function Hero({ oauth, error }: { oauth: boolean; error?: string | null }) {
  return (
    <section className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center gap-3">
        <span className="brush text-2xl leading-none text-white">知行</span>
        <span className="text-xs tracking-[0.2em] text-wall-dim">无行动，不知乎</span>
      </header>

      <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_minmax(320px,420px)]">
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
            {oauth ? (
              <a className="btn btn-seal" href="/api/auth/login">
                用知乎账号登录
              </a>
            ) : (
              <p className="text-sm text-wall-dim">服务端还没有配置知乎登录。</p>
            )}
          </div>
          {error && <p className="mt-4 text-sm text-[#e8897a]">{error}</p>}
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
      </div>
      
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-wall-dim">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </section>
  );
}
