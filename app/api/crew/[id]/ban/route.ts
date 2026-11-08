import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { invites, parkings, users } from "@/db/schema";
import { bad, handle, requireAdmin } from "@/lib/auth";
import { award } from "@/lib/doubloons";
import { REWARD } from "@/lib/game";

/** 선원 추방 (관리자 전용) */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (id === admin.id) bad("자기 자신은 추방할 수 없어요.");

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) bad("선원을 찾을 수 없어요.", 404);
  if (target.role === "admin") bad("관리자는 추방할 수 없어요.");
  if (target.status === "banned") bad("이미 추방된 선원이에요.");

  // 추천인 책임: 데려온 선원이 추방되면 금화 차감
  if (target.referrerId) await award(target.referrerId, REWARD.banPenalty, "lineage_ban", id);

  const now = new Date();
  await db.update(users).set({ status: "banned" }).where(eq(users.id, id));
  // 미사용 승선권 무효화
  await db
    .update(invites)
    .set({ expiresAt: now })
    .where(and(eq(invites.createdBy, id), isNull(invites.usedBy)));
  // 정박 중이면 종료
  await db
    .update(parkings)
    .set({ endedAt: now })
    .where(and(eq(parkings.userId, id), isNull(parkings.endedAt)));

  return NextResponse.json({ ok: true });
});
