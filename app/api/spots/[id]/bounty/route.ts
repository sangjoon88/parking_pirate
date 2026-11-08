import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { spend } from "@/lib/doubloons";
import { BOUNTY_POST } from "@/lib/game";

/** 내 금화로 정박지에 현상금 걸기: 다음에 "차단기 그대로 없음"을 확인한 선원이 받는다 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < BOUNTY_POST.min || amount > BOUNTY_POST.max) {
    bad(`현상금은 ${BOUNTY_POST.min}~${BOUNTY_POST.max}두블룬으로 걸 수 있어요.`);
  }
  const [spot] = await db.select({ status: spots.status }).from(spots).where(eq(spots.id, id)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);
  if (spot.status !== "open") bad("닫힌 정박지에는 현상금을 걸 수 없어요.");

  await spend(user.id, amount, "bounty_post", id, (tx) =>
    tx
      .update(spots)
      .set({ postedBounty: sql`${spots.postedBounty} + ${amount}` })
      .where(eq(spots.id, id)),
  );
  return NextResponse.json({ ok: true });
});
