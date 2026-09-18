import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { FriendsPage } from "@/components/FriendsPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await getSession();
  if (!s) redirect("/");
  return <FriendsPage session={{ kind: s.kind, identity: s.identity, user: s.user }} />;
}
