import { NextResponse, type NextRequest } from "next/server";
import { newState, oauthConfigured } from "@/lib/session";

export function GET(req: NextRequest) {
  if (!oauthConfigured()) {
    return NextResponse.redirect(new URL("/?error=oauth_unconfigured", req.url));
  }
  const url = new URL("https://openapi.zhihu.com/authorize");
  url.searchParams.set("redirect_uri", process.env.ZHIHU_OAUTH_REDIRECT_URI!);
  url.searchParams.set("app_id", process.env.ZHIHU_OAUTH_APP_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", newState());
  return NextResponse.redirect(url);
}
