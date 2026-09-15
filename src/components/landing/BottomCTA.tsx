import React from 'react';

export function BottomCTA({ oauth }: { oauth: boolean }) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
      <h2 className="song text-3xl font-semibold leading-tight text-white sm:text-4xl mb-10">
        是时候给你的收藏夹<br />来一次大扫除了。
      </h2>
      
      <div className="flex justify-center mb-16">
        {oauth ? (
          <a className="btn btn-seal text-lg px-8 py-3" href="/api/auth/login">
            用知乎账号登录
          </a>
        ) : (
          <p className="text-sm text-wall-dim">服务端还没有配置知乎登录。</p>
        )}
      </div>

      <footer className="text-[11px] text-wall-dim pt-8 border-t border-white/10">
        数据来自知乎开放平台 · 知行只读取你授权范围内的收藏标题与摘要
      </footer>
    </section>
  );
}
