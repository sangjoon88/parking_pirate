import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { parkings } from "@/db/schema";
import { handle, requireUser } from "@/lib/auth";
import { closeStaleParkings, settleParking } from "@/lib/parking";

/** 출항(정박 종료). 인정된 정박이면 이때 보상을 정산한다 */
export const POST = handle(async () => {
  const user = await requireUser();
  await closeStaleParkings(user.id);
  // 종료 시각을 바꾼 요청만 정산 (두 번 눌러도 한 번만)
  const [ended] = await db
    .update(parkings)
    .set({ endedAt: new Date() })
    .where(and(eq(parkings.userId, user.id), isNull(parkings.endedAt)))
    .returning({ id: parkings.id, userId: parkings.userId, spotId: parkings.spotId });
  if (!ended) return NextResponse.json({ ok: true, settlement: null });
  return NextResponse.json({ ok: true, settlement: await settleParking(ended) });
});
