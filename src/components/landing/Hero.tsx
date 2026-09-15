import React from 'react';
export function Hero({ oauth, error }: { oauth: boolean; error?: string | null }) {
  return (
    <section className="min-h-dvh flex flex-col items-center justify-center text-center">
      <h1>你收藏过的每一条干货，都欠自己两分钟。</h1>
      {/* existing hero content here later */}
    </section>
  );
}
