import "server-only";
import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { parkings, spotReports, spots, users } from "@/db/schema";
import { PARKING_MAX_HOURS } from "./constants";
import { award, awardedRecently } from "./doubloons";
import { boosted, FLEET_SIZE, NAVY_ALERT_MINUTES, REWARD, TOLL } from "./game";
import { lordsBySpot } from "./lords";
import { COUNTED_PARKINGS, parkingVerdict } from "./parkingRules";
import { claimStash, claimTreasure } from "./treasure";

const cutoff = () => new Date(Date.now() - PARKING_MAX_HOURS * 3600_000);

/** 12시간 넘게 열려 있던 정박을 자동 종료 처리 (종료 시각 = 시작 + 12시간). 인정된 정박이면 보상도 지급 */
export async function closeStaleParkings(userId?: string) {
  const closed = await db
    .update(parkings)
    .set({ endedAt: sql`${parkings.startedAt} + make_interval(hours => ${PARKING_MAX_HOURS})` })
    .where(
      and(
        isNull(parkings.endedAt),
        lte(parkings.startedAt, cutoff()),
        userId ? eq(parkings.userId, userId) : undefined,
      ),
    )
    .returning({ id: parkings.id, userId: parkings.userId, spotId: parkings.spotId });
  for (const p of closed) await settleParking(p);
}

import type { Settlement } from "./types";

/**
 * 정박이 끝났을 때(출항 또는 12시간 자동 종료) 보상 정산.
 * 인정된 정박(3시간 이상 · 하루 3번 · 같은 곳 6시간 간격)에만 정박 금화·통행세·보물상자·묻힌 보물·함대 집결을 준다.
 * 종료 시각을 바꾼 쪽(조건부 update의 returning)만 부르므로 한 정박에 한 번만 정산된다.
 */
export async function settleParking(p: { id: string; userId: string; spotId: string }): Promise<Settlement> {
  const verdict = await parkingVerdict(p.id);
  const out: Settlement = { ...verdict, earned: 0, fleet: false, events: [] };
  if (!verdict.counted) return out;

  const amount = boosted("parking", REWARD.parking);
  await award(p.userId, amount, "parking", p.spotId);
  out.earned += amount;

  // 통행세: 영주가 아닌 선원의 인정된 정박마다 영주에게
  const lord = (await lordsBySpot(p.spotId)).get(p.spotId);
  if (lord && lord.userId !== p.userId) {
    await award(lord.userId, TOLL, "toll", p.spotId);
    out.events.push(`🏰 영주 ${lord.nickname}님께 통행세 ${TOLL}두블룬이 갔어요`);
  }

  // 오늘의 보물상자: 오늘 이 정박지에서 처음으로 인정된 정박을 마친 선원
  const treasure = await claimTreasure(p.userId, p.spotId);
  if (treasure > 0) {
    await award(p.userId, treasure, "treasure", p.spotId);
    out.earned += treasure;
    out.events.push(`📦 오늘의 보물상자 발견! +${treasure}`);
  }

  // 다른 선원이 묻어 둔 보물
  const stash = await claimStash(p.userId, p.spotId);
  if (stash) {
    await award(p.userId, stash.amount, "stash_found", p.spotId);
    out.earned += stash.amount;
    out.events.push(`🪙 ${stash.by}님이 묻어 둔 보물 발견! +${stash.amount}`);
  }

  // 함대 집결: 내 정박 시간과 겹친 다른 선원의 인정된 정박이 2명 이상 (같은 정박지 12시간에 한 번)
  const res = await db.execute<{ n: string | number }>(sql`
    with me as (
      select started_at, coalesce(ended_at, now()) as ended_at from parkings where id = ${p.id}
    )
    select count(distinct c.user_id) as n from ${COUNTED_PARKINGS} c, me
    where c.spot_id = ${p.spotId} and c.user_id <> ${p.userId}
      and c.started_at < me.ended_at
      and coalesce(c.ended_at, least(now(), c.started_at + make_interval(hours => ${PARKING_MAX_HOURS}))) > me.started_at
  `);
  if (Number(res.rows[0]?.n ?? 0) >= FLEET_SIZE - 1) {
    out.fleet = true;
    if (!(await awardedRecently(p.userId, "fleet", PARKING_MAX_HOURS, p.spotId))) {
      await award(p.userId, REWARD.fleet, "fleet", p.spotId);
      out.earned += REWARD.fleet;
    }
  }
  return out;
}

/** 지금 정박 중인 기록 (+ 그 정박지의 해군 출몰 경보) */
export async function getActiveParking(userId: string) {
  const [row] = await db
    .select({
      id: parkings.id,
      spotId: parkings.spotId,
      spotName: spots.name,
      startedAt: parkings.startedAt,
    })
    .from(parkings)
    .innerJoin(spots, eq(spots.id, parkings.spotId))
    .where(and(eq(parkings.userId, userId), isNull(parkings.endedAt), gt(parkings.startedAt, cutoff())))
    .limit(1);
  if (!row) return null;

  const [alert] = await db
    .select({ at: spotReports.createdAt, by: users.nickname })
    .from(spotReports)
    .innerJoin(users, eq(users.id, spotReports.userId))
    .where(
      and(
        eq(spotReports.spotId, row.spotId),
        eq(spotReports.guardLevel, 5),
        gt(spotReports.createdAt, new Date(Date.now() - NAVY_ALERT_MINUTES * 60_000)),
      ),
    )
    .orderBy(desc(spotReports.createdAt))
    .limit(1);

  return { ...row, navyAlert: alert ? { at: alert.at.toISOString(), by: alert.by } : null };
}

/** 지금 이 정박지에 정박 중인 선원 id 목록 */
export async function activeParkersAt(spotId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: parkings.userId })
    .from(parkings)
    .where(and(eq(parkings.spotId, spotId), isNull(parkings.endedAt), gt(parkings.startedAt, cutoff())));
  return rows.map((r) => r.userId);
}
