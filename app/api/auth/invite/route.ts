import { NextResponse } from "next/server";
import { handle } from "@/lib/auth";
import { checkInvite } from "@/lib/invite-check";
import { normalizeInviteCode } from "@/lib/invite";

// 가입 화면에서 승선권 확인용 (비로그인 접근 허용)
export const GET = handle(async (req: Request) => {
  const code = normalizeInviteCode(new URL(req.url).searchParams.get("code") ?? "");
  const result = await checkInvite(code);
  return NextResponse.json(result);
});
