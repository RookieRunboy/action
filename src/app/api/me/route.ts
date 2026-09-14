import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest, oauthConfigured } from "@/lib/session";

export function GET(req: NextRequest) {
  const s = getSessionFromRequest(req);
  return NextResponse.json({
    session: s ? { kind: s.kind, user: s.user } : null,
    oauth: oauthConfigured(),
  });
}
