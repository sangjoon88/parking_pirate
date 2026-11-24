import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { parkings, spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { PARKING_RULE } from "@/lib/game";
import { closeStaleParkings, getActiveParking } from "@/lib/parking";

/**
 * 정박 시작. 위치(GPS) 확인은 하지 않는다.
 * 주차하고 사무실 등으로 이동한 뒤에 기록하는 경우가 많아서 운영 결정으로 껐다.
 * 대신 보상은 출항할 때, 인정된 정박(lib/parkingRules.ts)에만 준다.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const spotId = typeof body.spotId === "string" ? body.spotId : "";

  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);
  if (spot.status === "closed") bad("차단기가 생긴 정박지라 정박할 수 없어요.");

  await closeStaleParkings(user.id);
  const active = await getActiveParking(user.id);
  if (active) bad(`이미 ${active.spotName}에 정박 중이에요. 먼저 출항해 주세요.`, 409);

  try {
    await db.insert(parkings).values({ userId: user.id, spotId: spot.id });
  } catch {
    // 동시 요청으로 유니크 인덱스(한 사람당 하나) 위반
    bad("이미 정박 중이에요.", 409);
  }

  // 보상은 출항할 때 정산한다 (인정된 정박만: 3시간 이상 · 하루 3번 · 같은 곳 6시간 간격)
  return NextResponse.json({ parking: await getActiveParking(user.id), rule: PARKING_RULE }, { status: 201 });
});
