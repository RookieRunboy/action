import { App } from "@/components/App";
import { demoEnabled, getSession, oauthConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  return (
    <App
      initialSession={session ? { kind: session.kind, user: session.user, identity: session.identity } : null}
      oauth={oauthConfigured()}
      demo={demoEnabled() && !!process.env.ZHIHU_ACCESS_SECRET}
      error={params.error}
    />
  );
}
