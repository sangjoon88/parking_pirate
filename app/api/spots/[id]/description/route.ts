import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { DESCRIPTION_MAX } from "@/lib/game";

/** 정박지 소개 고치기: 누구나 (위키처럼 마지막으로 고친 선원이 표시됨) */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > DESCRIPTION_MAX) bad(`소개는 ${DESCRIPTION_MAX}자까지 쓸 수 있어요.`);

  const updated = await db
    .update(spots)
    .set({ description: description || null, descriptionBy: user.id, descriptionAt: new Date() })
    .where(eq(spots.id, id))
    .returning({ id: spots.id });
  if (!updated.length) bad("정박지를 찾을 수 없어요.", 404);
  return NextResponse.json({ ok: true });
});
