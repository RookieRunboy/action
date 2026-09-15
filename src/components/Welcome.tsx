"use client";

import { Hero } from "./landing/Hero";
import { AISorting } from "./landing/AISorting";
import { DailyAction } from "./landing/DailyAction";
import { CommunityLoop } from "./landing/CommunityLoop";
import { BottomCTA } from "./landing/BottomCTA";

interface Props {
  oauth: boolean;
  error?: string | null;
}

export function Welcome({ oauth, error }: Props) {
  return (
    <main className="bg-wall-base text-wall-ink">
      <Hero oauth={oauth} error={error} />
      <AISorting />
      <DailyAction />
      <CommunityLoop />
      <BottomCTA oauth={oauth} />
    </main>
  );
}
