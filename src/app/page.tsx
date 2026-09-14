import { redirect } from "next/navigation";
import { Welcome } from "@/components/Welcome";
import { demoEnabled, getSession, oauthConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  oauth_unconfigured: "还没配置知乎登录凭证，先用体验模式看看。",
  state_mismatch: "登录请求已过期或被篡改，请重新登录。",
  no_code: "知乎没有返回授权码，请重新登录。",
  token_exchange_failed: "向知乎换取登录凭证失败，请重试。",
  profile_failed: "读取知乎账号信息失败，请重试。",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  if (session) redirect("/today");
  return (
    <Welcome
      oauth={oauthConfigured()}
      demo={demoEnabled() && !!process.env.ZHIHU_ACCESS_SECRET}
      error={params.error ? ERRORS[params.error] || "登录失败，请重试。" : null}
    />
  );
}
