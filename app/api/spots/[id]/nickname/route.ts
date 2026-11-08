import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { listSpots } from "@/lib/spots";

/** 전설의 정박지 별명 짓기: 그 정박지의 영주만 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (nickname.length < 2 || nickname.length > 16) bad("별명은 2~16자로 지어 주세요.");

  const {
    spots: [spot],
  } = await listSpots(id);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);
  if (!spot.legendary) bad("누적 정박 100회를 넘긴 전설의 정박지만 별명을 붙일 수 있어요.");
  if (spot.lord?.userId !== user.id) bad("이 정박지의 영주만 별명을 지을 수 있어요.");

  await db.update(spots).set({ nickname }).where(eq(spots.id, id));
  return NextResponse.json({ ok: true });
});
