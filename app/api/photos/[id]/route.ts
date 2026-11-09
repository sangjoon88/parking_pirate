import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";

const UUID = /^[0-9a-f-]{36}$/i;

/** 사진 보기 (로그인한 선원만). 사진은 바뀌지 않으므로 브라우저에 오래 캐시 */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("사진을 찾을 수 없어요.", 404);
  const [p] = await db.select({ mime: photos.mime, data: photos.data }).from(photos).where(eq(photos.id, id)).limit(1);
  if (!p) bad("사진을 찾을 수 없어요.", 404);
  return new Response(new Uint8Array(p.data), {
    headers: {
      "Content-Type": p.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/** 사진 지우기: 올린 선원 또는 관리자 */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("사진을 찾을 수 없어요.", 404);
  const [p] = await db.select({ userId: photos.userId }).from(photos).where(eq(photos.id, id)).limit(1);
  if (!p) bad("이미 지워진 사진이에요.", 404);
  if (p.userId !== user.id && user.role !== "admin") bad("올린 선원만 지울 수 있어요.", 403);
  await db.delete(photos).where(eq(photos.id, id));
  return NextResponse.json({ ok: true });
});
