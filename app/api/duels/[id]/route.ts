import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { doubloonLogs, duels } from "@/db/schema";
import { bad, handle, HttpError, readJson, requireUser } from "@/lib/auth";
import { spend } from "@/lib/doubloons";
import { settleDuels } from "@/lib/duels";
import { DUEL_DAYS } from "@/lib/game";

/** 결투 수락 / 거절 (상대만) */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson(req);
  const action = body.action;
  await settleDuels();

  const [d] = await db.select().from(duels).where(eq(duels.id, id)).limit(1);
  if (!d) bad("결투를 찾을 수 없어요.", 404);
  if (d.opponentId !== user.id) bad("결투 신청을 받은 선원만 응답할 수 있어요.", 403);
  if (d.status !== "pending") bad("이미 끝났거나 시작된 결투예요.");

  if (action === "accept") {
    const now = new Date();
    await spend(user.id, d.stake, "duel_stake", d.id, async (tx) => {
      const started = await tx
        .update(duels)
        .set({ status: "active", startsAt: now, endsAt: new Date(now.getTime() + DUEL_DAYS * 86400_000) })
        .where(and(eq(duels.id, id), eq(duels.status, "pending")))
        .returning({ id: duels.id });
      if (!started.length) throw new HttpError(400, "이미 끝났거나 시작된 결투예요.");
    });
  } else if (action === "decline") {
    const declined = await db
      .update(duels)
      .set({ status: "declined" })
      .where(and(eq(duels.id, id), eq(duels.status, "pending")))
      .returning({ id: duels.id });
    if (declined.length) {
      await db.insert(doubloonLogs).values({ userId: d.challengerId, amount: d.stake, reason: "duel_refund", refId: d.id });
    }
  } else {
    bad("알 수 없는 요청이에요.");
  }
  return NextResponse.json({ ok: true });
});
