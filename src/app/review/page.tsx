import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isValidISODate, todayISO } from "@/lib/dates";
import { ReviewPage } from "@/components/ReviewPage";
import type { StatsFilter } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; kind?: string }>;
}) {
  const [s, params] = await Promise.all([getSession(), searchParams]);
  if (!s) redirect("/");

  const date = params.date && isValidISODate(params.date) ? params.date : todayISO();
  const kind: StatsFilter =
    params.kind === "action" || params.kind === "flash" ? params.kind : "all";

  return (
    <ReviewPage
      session={{ kind: s.kind, identity: s.identity, user: s.user }}
      date={date}
      initialKind={kind}
    />
  );
}
