import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { guardContacts, spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { GUARD_CONTACTS_MAX, GUARD_LABEL_MAX } from "@/lib/game";

const UUID = /^[0-9a-f-]{36}$/i;

/** 경비원 메모 추가: 누구나. 번호는 뒷자리 4자리만 받는다 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("정박지를 찾을 수 없어요.", 404);
  const body = await readJson(req);
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const digits = typeof body.digits === "string" ? body.digits.trim() : "";
  if (!/^[0-9]{4}$/.test(digits)) bad("번호 뒷자리 4자리 숫자를 적어 주세요.");
  if (label.length > GUARD_LABEL_MAX) bad(`메모는 ${GUARD_LABEL_MAX}자까지 쓸 수 있어요.`);

  const [spot] = await db.select({ id: spots.id }).from(spots).where(eq(spots.id, id)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);
  const [row] = await db.select({ n: count() }).from(guardContacts).where(eq(guardContacts.spotId, id));
  if ((row?.n ?? 0) >= GUARD_CONTACTS_MAX) bad(`경비원 메모는 정박지당 ${GUARD_CONTACTS_MAX}개까지예요. 오래된 걸 지워 주세요.`);

  await db.insert(guardContacts).values({ spotId: id, userId: user.id, label, digits });
  return NextResponse.json({ ok: true }, { status: 201 });
});
