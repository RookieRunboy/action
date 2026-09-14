import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PlanPage } from "@/components/PlanPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await getSession();
  if (!s) redirect("/");
  return <PlanPage session={{ kind: s.kind, identity: s.identity, user: s.user }} />;
}
