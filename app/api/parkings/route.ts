import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { parkings, spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { distanceMeters, isValidCoord, PARKING_RADIUS_M } from "@/lib/geo";
import { closeStaleParkings, getActiveParking } from "@/lib/parking";

/** 정박 시작. 좌표는 거리 확인에만 쓰고 저장하지 않는다. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const spotId = typeof body.spotId === "string" ? body.spotId : "";
  const { lat, lng } = body;
  if (!isValidCoord(lat, lng)) bad("현재 위치를 확인할 수 없어요.");

  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);
  if (spot.status === "closed") bad("차단기가 생긴 정박지라 정박할 수 없어요.");

  const d = distanceMeters(lat, lng as number, spot.lat, spot.lng);
  if (d > PARKING_RADIUS_M) {
    bad(`정박지에서 ${Math.round(d)}m 떨어져 있어요. ${PARKING_RADIUS_M}m 안에서만 정박할 수 있어요.`);
  }

  await closeStaleParkings(user.id);
  const active = await getActiveParking(user.id);
  if (active) bad(`이미 ${active.spotName}에 정박 중이에요. 먼저 출항해 주세요.`, 409);

  try {
    await db.insert(parkings).values({ userId: user.id, spotId: spot.id });
  } catch {
    // 동시 요청으로 유니크 인덱스(한 사람당 하나) 위반
    bad("이미 정박 중이에요.", 409);
  }
  return NextResponse.json({ parking: await getActiveParking(user.id) }, { status: 201 });
});
