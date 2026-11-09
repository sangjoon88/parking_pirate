import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { wonders } from "@/db/schema";
import { award } from "./doubloons";
import { REWARD } from "./game";
import { distanceMeters, DUPLICATE_SPOT_RADIUS_M } from "./geo";

/**
 * 새 정박지가 등록되면 반경 100m 안의 궁금한 곳(❓)을 해결 처리하고,
 * 찍어 둔 선원에게 보상한다 (자기가 찍고 자기가 등록한 경우는 보상 없음).
 * 해결된 개수를 돌려준다.
 */
export async function resolveWondersNear(spot: { id: string; lat: number; lng: number }, registrantId: string) {
  const open = await db.select().from(wonders).where(isNull(wonders.resolvedAt));
  const near = open.filter((w) => distanceMeters(spot.lat, spot.lng, w.lat, w.lng) <= DUPLICATE_SPOT_RADIUS_M);
  if (!near.length) return 0;

  const resolved = await db
    .update(wonders)
    .set({ resolvedAt: new Date(), resolvedSpotId: spot.id })
    .where(and(inArray(wonders.id, near.map((w) => w.id)), isNull(wonders.resolvedAt)))
    .returning({ id: wonders.id, userId: wonders.userId });

  for (const w of resolved) {
    if (w.userId !== registrantId) await award(w.userId, REWARD.wonder, "wonder_solved", spot.id);
  }
  return resolved.length;
}

export async function openWonderCount(userId: string) {
  const rows = await db
    .select({ id: wonders.id })
    .from(wonders)
    .where(and(eq(wonders.userId, userId), isNull(wonders.resolvedAt)));
  return rows.length;
}
