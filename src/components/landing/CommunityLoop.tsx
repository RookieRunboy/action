import React from 'react';
import { MockReviewPreview } from './MockReviewPreview';
import { ScrollReveal } from './ScrollReveal';

export function CommunityLoop() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Visual: Left */}
        <ScrollReveal>
          <MockReviewPreview />
        </ScrollReveal>
        
        {/* Text: Right */}
        <ScrollReveal delay={150}>
          <h2 className="song text-3xl font-semibold leading-tight text-white sm:text-4xl">
            让好内容知道<br />自己被用过。
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wall-ink/85">
            不生产新内容，只让好内容流转。每次完成行动，一键回到知乎原贴留言。
          </p>
          <p className="mt-4 text-lg leading-relaxed text-wall-ink/85">
            让答主收到的不再只是点赞，而是「有人真的照做了」。
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
