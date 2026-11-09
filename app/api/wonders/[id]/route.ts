import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { wonders } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";

/** 궁금한 곳 지우기 (찍은 선원 또는 관리자) */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const [w] = await db.select().from(wonders).where(eq(wonders.id, id)).limit(1);
  if (!w) bad("이미 없어진 궁금한 곳이에요.", 404);
  if (w.userId !== user.id && user.role !== "admin") bad("찍은 선원만 지울 수 있어요.", 403);
  await db.delete(wonders).where(eq(wonders.id, id));
  return NextResponse.json({ ok: true });
});
