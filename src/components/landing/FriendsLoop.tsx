import React from 'react';
import { MockFriendsPreview } from './MockFriendsPreview';

export function FriendsLoop() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8 bg-black/20">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        {/* Text: Left */}
        <div className="order-2 lg:order-1">
          <h2 className="song text-3xl font-semibold leading-tight text-white sm:text-4xl">
            看看好友在练什么，<br />顺手加入自己的知行。
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-wall-ink/85">
            打开好友的主页，看他正在坚持的习惯和正在记忆的知识点。
          </p>
          <p className="mt-4 text-lg leading-relaxed text-wall-ink/85">
            觉得值得记的闪卡，一键加入你自己的复习队列。
          </p>
        </div>

        {/* Visual: Right */}
        <div className="order-1 lg:order-2 relative">
          <MockFriendsPreview />
        </div>
      </div>
    </section>
  );
}
