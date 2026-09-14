import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { scanFolder } from "@/lib/pipeline";
import { getFavlists, ZhihuError } from "@/lib/zhihu";
import { LLMError } from "@/lib/llm";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const s = getSessionFromRequest(req);
  if (!s) return NextResponse.json({ error: "还没有登录。" }, { status: 401 });
  const folder = req.nextUrl.searchParams.get("folder")?.trim() || "";
  if (!/^\d+$/.test(folder)) return NextResponse.json({ error: "缺少收藏夹。" }, { status: 400 });
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  try {
    if (s.kind === "demo") {
      const { folders } = await getFavlists(s.identity);
      const target = folders.find((f) => f.urlToken === folder);
      if (!target || !target.isPublic) return NextResponse.json({ error: "体验模式只能查看公开收藏夹。" }, { status: 403 });
    }
    const res = await scanFolder({ identity: s.identity, folderToken: folder, oauthToken: s.oauthToken, refresh });
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof ZhihuError) {
      const status = e.code === 20001 ? 401 : e.code === 30001 || e.code === 30002 ? 429 : 502;
      return NextResponse.json({ error: e.message, source: "zhihu" }, { status });
    }
    if (e instanceof LLMError) return NextResponse.json({ error: e.message, source: "llm" }, { status: 502 });
    console.error(e);
    return NextResponse.json({ error: "扫描收藏夹失败，稍后再试。" }, { status: 500 });
  }
}
