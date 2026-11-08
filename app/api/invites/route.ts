import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";
import { INVITE_DAYS, MAX_OPEN_INVITES } from "@/lib/constants";
import { generateInviteCode } from "@/lib/invite";

export const GET = handle(async () => {
  const user = await requireUser();
  const rows = await db
    .select({
      code: invites.code,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      usedBy: users.nickname,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.usedBy))
    .where(eq(invites.createdBy, user.id))
    .orderBy(desc(invites.expiresAt))
    .limit(20);
  return NextResponse.json({ invites: rows });
});

export const POST = handle(async () => {
  const user = await requireUser();
  const [open] = await db
    .select({ n: count() })
    .from(invites)
    .where(and(eq(invites.createdBy, user.id), isNull(invites.usedBy), gt(invites.expiresAt, new Date())));
  if ((open?.n ?? 0) >= MAX_OPEN_INVITES) {
    bad(`아직 안 쓴 승선권이 ${MAX_OPEN_INVITES}장 있어요. 그걸 먼저 써 주세요.`);
  }

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 3600_000);
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode();
    const res = await db
      .insert(invites)
      .values({ code, createdBy: user.id, expiresAt })
      .onConflictDoNothing()
      .returning({ code: invites.code });
    if (res.length) return NextResponse.json({ code, expiresAt }, { status: 201 });
  }
  bad("승선권 발급에 실패했어요. 다시 시도해 주세요.", 500);
});
