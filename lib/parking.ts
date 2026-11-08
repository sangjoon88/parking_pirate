import "server-only";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { parkings, spots } from "@/db/schema";
import { PARKING_MAX_HOURS } from "./constants";

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
  return row ?? null;
}
