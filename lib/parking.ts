import "server-only";
import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { parkings, spotReports, spots, users } from "@/db/schema";
import { PARKING_MAX_HOURS } from "./constants";
import { NAVY_ALERT_MINUTES } from "./game";

const cutoff = () => new Date(Date.now() - PARKING_MAX_HOURS * 3600_000);

/** 12시간 넘게 열려 있던 정박을 자동 종료 처리 (종료 시각 = 시작 + 12시간) */
export async function closeStaleParkings(userId?: string) {
  await db
    .update(parkings)
    .set({ endedAt: sql`${parkings.startedAt} + make_interval(hours => ${PARKING_MAX_HOURS})` })
    .where(
      and(
        isNull(parkings.endedAt),
        lte(parkings.startedAt, cutoff()),
        userId ? eq(parkings.userId, userId) : undefined,
      ),
    );
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
