import { NextResponse, type NextRequest } from "next/server";
import { demoEnabled, getSessionFromRequest, oauthConfigured } from "@/lib/session";

export function GET(req: NextRequest) {
  const s = getSessionFromRequest(req);
  return NextResponse.json({
    session: s ? { kind: s.kind, user: s.user } : null,
    oauth: oauthConfigured(),
    demo: demoEnabled() && !!process.env.ZHIHU_ACCESS_SECRET,
  });
}
