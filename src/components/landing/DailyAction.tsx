import React from 'react';

export function DailyAction() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8 bg-black/20">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Text: Left (Order 1 on desktop, 1 on mobile) */}
        <div className="order-2 lg:order-1">
          <h2 className="song text-3xl font-semibold leading-tight text-white sm:text-4xl">
            每天两分钟，<br />只做三件事。
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wall-ink/85">
            结合艾宾浩斯记忆曲线，每天为你推送最该做的事。
          </p>
          <p className="mt-4 text-lg leading-relaxed text-wall-ink/85">
            连续打卡成功，盖上「知行合一」专属印章。
          </p>
        </div>

        {/* Visual: Right (Order 2 on desktop, 2 on mobile) */}
        <div className="order-1 lg:order-2 relative aspect-square rounded-2xl bg-white/5 p-8 border border-white/10 flex items-center justify-center overflow-hidden">
           {/* Abstract Ebbinghaus curve background */}
           <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0,100 Q20,20 100,0" fill="none" stroke="currentColor" strokeWidth="2" />
           </svg>
           {/* Stamp visual */}
           <div className="relative rotate-[-5deg] border-2 border-[#e8897a] text-[#e8897a] rounded-full w-32 h-32 flex items-center justify-center opacity-80 mix-blend-screen">
             <span className="song text-6xl font-bold">行</span>
           </div>
        </div>
      </div>
    </section>
  );
}
