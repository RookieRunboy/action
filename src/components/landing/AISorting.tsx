import React from 'react';

export function AISorting() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Visual: Left */}
        <div className="relative aspect-square rounded-2xl bg-white/5 p-8 border border-white/10 flex items-center justify-center">
           <div className="text-center text-wall-dim">
             <div className="text-4xl mb-4">🤖</div>
             <div className="text-sm border border-wall-dim/30 rounded px-4 py-2 inline-block">AI 正在提取能做的行动...</div>
           </div>
        </div>
        
        {/* Text: Right */}
        <div>
          <h2 className="song text-3xl font-semibold leading-tight text-white sm:text-4xl">
            收藏夹里几百篇干货？<br />交给 AI 去挑。
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wall-ink/85">
            知行会帮你把长文分拣成「能做的行动」和「值得记的闪卡」。
          </p>
          <p className="mt-4 text-lg leading-relaxed text-wall-ink/85">
            至于单纯的故事和情绪，我们会诚实地放过，绝不硬转成任务。
          </p>
        </div>
      </div>
    </section>
  );
}
