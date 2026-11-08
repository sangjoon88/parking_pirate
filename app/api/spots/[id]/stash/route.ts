import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spots, stashes } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { spend } from "@/lib/doubloons";
import { STASH } from "@/lib/game";

/** 보물 묻기: 내 금화를 정박지에 묻어 두면 다음에 정박한 다른 선원이 가져간다 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < STASH.min || amount > STASH.max) {
    bad(`보물은 ${STASH.min}~${STASH.max}두블룬 묻을 수 있어요.`);
  }
  const [spot] = await db.select({ status: spots.status }).from(spots).where(eq(spots.id, id)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);
  if (spot.status !== "open") bad("닫힌 정박지에는 묻을 수 없어요.");

  await spend(user.id, amount, "stash_hide", id, (tx) =>
    tx.insert(stashes).values({ spotId: id, userId: user.id, amount }),
  );
  return NextResponse.json({ ok: true });
});
