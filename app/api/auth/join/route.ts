import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { bad, handle, HttpError, readJson, setSessionCookie } from "@/lib/auth";
import { normalizeInviteCode } from "@/lib/invite";
import { checkInvite } from "@/lib/invite-check";
import { validNickname, validPassword } from "@/lib/validate";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const code = normalizeInviteCode(typeof body.code === "string" ? body.code : "");
  const nickname = validNickname(body.nickname);
  const password = validPassword(body.password);
  if (!nickname) bad("닉네임은 2~12자 한글·영문·숫자·_ 만 쓸 수 있어요.");
  if (!password) bad("비밀번호는 6자 이상으로 정해 주세요.");

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.transaction(async (tx) => {
    // 가입은 한 번에 하나씩: 인원 제한 경쟁 상태 방지
    await tx.execute(sql`select pg_advisory_xact_lock(20240001)`);

    const check = await checkInvite(code, tx);
    if (!check.ok) throw new HttpError(400, check.message);

    const [dup] = await tx.select({ id: users.id }).from(users).where(eq(users.nickname, nickname)).limit(1);
    if (dup) throw new HttpError(409, "이미 있는 닉네임이에요. 다른 닉네임을 골라 주세요.");

    const [invite] = await tx.select().from(invites).where(eq(invites.code, code)).limit(1);

    const [created] = await tx
      .insert(users)
      .values({ nickname, passwordHash, referrerId: invite.createdBy, role: "member" })
      .returning();

    const used = await tx
      .update(invites)
      .set({ usedBy: created.id, usedAt: new Date() })
      .where(and(eq(invites.code, code), isNull(invites.usedBy)))
      .returning({ code: invites.code });
    if (used.length !== 1) throw new HttpError(400, "이미 사용된 승선권이에요.");

    return created;
  });

  await setSessionCookie(user);
  return NextResponse.json({ ok: true });
});
