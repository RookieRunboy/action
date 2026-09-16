import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getSeedFolders } from "@/lib/seed-library";

export async function GET(req: NextRequest) {
  const s = getSessionFromRequest(req);
  if (!s) return NextResponse.json({ error: "还没有登录。" }, { status: 401 });
  const { folders, stale } = await getSeedFolders();
  return NextResponse.json({ folders, stale });
}
