import React from 'react';
import { MockLeafPreview } from './MockLeafPreview';
import { ScrollReveal } from './ScrollReveal';

export function DailyAction() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8 bg-black/20">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Text: Left */}
        <ScrollReveal className="order-2 lg:order-1" delay={150}>
          <h2 className="song text-3xl font-semibold leading-tight text-white sm:text-4xl">
            每天两分钟，<br />只做三件事。
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wall-ink/85">
            结合艾宾浩斯记忆曲线，每天为你推送最该做的事。
          </p>
          <p className="mt-4 text-lg leading-relaxed text-wall-ink/85">
            连续打卡成功，盖上「知行合一」专属印章。
          </p>
        </ScrollReveal>

        {/* Visual: Right */}
        <ScrollReveal className="order-1 lg:order-2 relative">
          <MockLeafPreview />
        </ScrollReveal>
      </div>
    </section>
  );
}
