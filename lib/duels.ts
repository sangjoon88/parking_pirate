import "server-only";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { doubloonLogs, duels } from "@/db/schema";
import { DUEL_PENDING_DAYS } from "./game";

async function parkCount(userId: string, from: Date, to: Date): Promise<number> {
  const res = await db.execute<{ n: string | number }>(sql`
    select count(*) as n from parkings
    where user_id = ${userId} and started_at >= ${from.toISOString()} and started_at < ${to.toISOString()}`);
  return Number(res.rows[0]?.n ?? 0);
}

/** 기한 지난 결투를 정산한다. 상태 전환이 조건부 update라 여러 번 불려도 한 번만 정산된다 */
export async function settleDuels() {
  const now = new Date();

  // 응답 없는 신청은 만료 → 신청자 환불
  const stale = await db
    .update(duels)
    .set({ status: "expired" })
    .where(
      and(eq(duels.status, "pending"), lt(duels.createdAt, new Date(now.getTime() - DUEL_PENDING_DAYS * 86400_000))),
    )
    .returning();
  for (const d of stale) {
    await db.insert(doubloonLogs).values({ userId: d.challengerId, amount: d.stake, reason: "duel_refund", refId: d.id });
  }

  // 기간 끝난 결투 → 승자에게 판돈 2배, 무승부면 각자 환불
  const due = await db.select().from(duels).where(and(eq(duels.status, "active"), lt(duels.endsAt, now)));
  for (const d of due) {
    const [a, b] = await Promise.all([
      parkCount(d.challengerId, d.startsAt!, d.endsAt!),
      parkCount(d.opponentId, d.startsAt!, d.endsAt!),
    ]);
    const winnerId = a === b ? null : a > b ? d.challengerId : d.opponentId;
    const done = await db
      .update(duels)
      .set({ status: "done", winnerId, challengerScore: a, opponentScore: b })
      .where(and(eq(duels.id, d.id), eq(duels.status, "active")))
      .returning({ id: duels.id });
    if (!done.length) continue;
    if (winnerId) {
      await db.insert(doubloonLogs).values({ userId: winnerId, amount: d.stake * 2, reason: "duel_win", refId: d.id });
    } else {
      await db.insert(doubloonLogs).values([
        { userId: d.challengerId, amount: d.stake, reason: "duel_refund", refId: d.id },
        { userId: d.opponentId, amount: d.stake, reason: "duel_refund", refId: d.id },
      ]);
    }
  }
}

/** 내 결투 목록 (진행 중이면 현재 점수 포함) */
export async function duelsOf(userId: string) {
  await settleDuels();
  const rows = await db
    .select()
    .from(duels)
    .where(or(eq(duels.challengerId, userId), eq(duels.opponentId, userId)))
    .orderBy(desc(duels.createdAt))
    .limit(10);
  const now = new Date();
  return Promise.all(
    rows.map(async (d) => {
      if (d.status !== "active") return d;
      const [a, b] = await Promise.all([
        parkCount(d.challengerId, d.startsAt!, now),
        parkCount(d.opponentId, d.startsAt!, now),
      ]);
      return { ...d, challengerScore: a, opponentScore: b };
    }),
  );
}
