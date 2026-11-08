import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyTreasures, spots, stashes } from "@/db/schema";
import { kstDay, TREASURE_MAX, TREASURE_MIN } from "./game";

/** 오늘의 보물상자. 없으면 열린 정박지 중 하나에 랜덤으로 만든다 */
export async function todayTreasure() {
  const day = kstDay();
  const [existing] = await db.select().from(dailyTreasures).where(eq(dailyTreasures.day, day)).limit(1);
  if (existing) return existing;

  const [pick] = await db
    .select({ id: spots.id })
    .from(spots)
    .where(eq(spots.status, "open"))
    .orderBy(sql`random()`)
    .limit(1);
  if (!pick) return null;
  // 20~100, 10 단위
  const amount = TREASURE_MIN + Math.floor(Math.random() * ((TREASURE_MAX - TREASURE_MIN) / 10 + 1)) * 10;
  await db.insert(dailyTreasures).values({ day, spotId: pick.id, amount }).onConflictDoNothing();
  const [row] = await db.select().from(dailyTreasures).where(eq(dailyTreasures.day, day)).limit(1);
  return row ?? null;
}

/** 이 정박지에 오늘의 보물이 남아 있으면 가져간다. 받은 금액(없으면 0) */
export async function claimTreasure(userId: string, spotId: string): Promise<number> {
  const t = await todayTreasure();
  if (!t || t.spotId !== spotId || t.claimedBy) return 0;
  const got = await db
    .update(dailyTreasures)
    .set({ claimedBy: userId, claimedAt: new Date() })
    .where(and(eq(dailyTreasures.day, t.day), isNull(dailyTreasures.claimedBy)))
    .returning({ amount: dailyTreasures.amount });
  return got[0]?.amount ?? 0;
}

/** 이 정박지에 다른 선원이 묻은 보물이 있으면 가장 오래된 것 하나를 가져간다 */
export async function claimStash(userId: string, spotId: string): Promise<{ amount: number; by: string } | null> {
  const res = await db.execute<{ amount: number; nickname: string }>(sql`
    with target as (
      select id from stashes
      where spot_id = ${spotId} and found_by is null and user_id <> ${userId}
      order by created_at limit 1
      for update skip locked
    )
    update stashes s set found_by = ${userId}, found_at = now()
    from target, users u
    where s.id = target.id and u.id = s.user_id
    returning s.amount, u.nickname
  `);
  const r = res.rows[0];
  return r ? { amount: Number(r.amount), by: r.nickname } : null;
}

/** 이 정박지에 아직 안 찾은 묻힌 보물이 있는지 (소문용) */
export async function hasStash(spotIds: string[]): Promise<Set<string>> {
  if (!spotIds.length) return new Set();
  const rows = await db
    .selectDistinct({ spotId: stashes.spotId })
    .from(stashes)
    .where(isNull(stashes.foundBy));
  return new Set(rows.map((r) => r.spotId));
}
