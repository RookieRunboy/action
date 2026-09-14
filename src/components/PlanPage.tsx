"use client";
import { AppShell, type ClientSession } from "./AppShell";
export function PlanPage({ session }: { session: ClientSession }) {
  return <AppShell active="plan" session={session}><p className="text-wall-dim">筹划页施工中。</p></AppShell>;
}
