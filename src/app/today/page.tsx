import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isValidISODate, todayISO } from "@/lib/dates";
import { TodayPage } from "@/components/TodayPage";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [s, params] = await Promise.all([getSession(), searchParams]);
  if (!s) redirect("/");
  const date = params.date && isValidISODate(params.date) ? params.date : todayISO();
  return <TodayPage session={{ kind: s.kind, identity: s.identity, user: s.user }} date={date} />;
}
