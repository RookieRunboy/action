import React from 'react';

export function CommunityLoop() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Visual: Left */}
        <div className="relative aspect-video lg:aspect-square rounded-2xl bg-white/5 p-8 border border-white/10 flex items-center justify-center">
           <div className="bg-wall-base border border-wall-dim/20 rounded-xl p-4 w-full max-w-sm shadow-2xl">
             <div className="flex gap-3 mb-3">
               <div className="w-8 h-8 rounded-full bg-white/10"></div>
               <div className="flex-1">
                 <div className="h-3 w-24 bg-white/20 rounded mb-2"></div>
                 <div className="h-2 w-16 bg-white/10 rounded"></div>
               </div>
             </div>
             <p className="text-sm text-white/80 mb-4">谢谢答主，我今天照着做了一遍，感觉很有收获！</p>
             <button className="w-full py-2 bg-seal-2/20 text-seal-2 rounded text-sm border border-seal-2/30">一键回响</button>
           </div>
        </div>
        
        {/* Text: Right */}
        <div>
          <h2 className="song text-3xl font-semibold leading-tight text-white sm:text-4xl">
            让好内容知道<br />自己被用过。
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wall-ink/85">
            不生产新内容，只让好内容流转。每次完成行动，一键回到知乎原贴留言。
          </p>
          <p className="mt-4 text-lg leading-relaxed text-wall-ink/85">
            让答主收到的不再只是点赞，而是「有人真的照做了」。
          </p>
        </div>
      </div>
    </section>
  );
}
