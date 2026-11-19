import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { guardContacts } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";

const UUID = /^[0-9a-f-]{36}$/i;

/** 경비원 메모 지우기: 적은 선원 또는 관리자 */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("메모를 찾을 수 없어요.", 404);
  const [g] = await db.select({ userId: guardContacts.userId }).from(guardContacts).where(eq(guardContacts.id, id)).limit(1);
  if (!g) bad("이미 지워진 메모예요.", 404);
  if (g.userId !== user.id && user.role !== "admin") bad("적은 선원만 지울 수 있어요.", 403);
  await db.delete(guardContacts).where(eq(guardContacts.id, id));
  return NextResponse.json({ ok: true });
});
