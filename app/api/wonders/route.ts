import { desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, wonders } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { WONDER_MAX_OPEN, WONDER_NOTE_MAX } from "@/lib/game";
import { isValidCoord } from "@/lib/geo";
import { openWonderCount } from "@/lib/wonders";

/** 아직 해결 안 된 궁금한 곳 (선원 모두 공유) */
export const GET = handle(async () => {
  const user = await requireUser();
  const rows = await db
    .select({
      id: wonders.id,
      lat: wonders.lat,
      lng: wonders.lng,
      note: wonders.note,
      createdAt: wonders.createdAt,
      userId: wonders.userId,
      nickname: users.nickname,
    })
    .from(wonders)
    .innerJoin(users, eq(users.id, wonders.userId))
    .where(isNull(wonders.resolvedAt))
    .orderBy(desc(wonders.createdAt))
    .limit(100);
  return NextResponse.json({
    wonders: rows.map(({ userId, ...w }) => ({ ...w, mine: userId === user.id })),
    canDeleteAll: user.role === "admin",
  });
});

/** 궁금한 곳 찍기 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const { lat, lng } = body;
  if (!isValidCoord(lat, lng)) bad("위치가 올바르지 않아요.");
  if (note.length > WONDER_NOTE_MAX) bad(`메모는 ${WONDER_NOTE_MAX}자까지예요.`);
  if ((await openWonderCount(user.id)) >= WONDER_MAX_OPEN) {
    bad(`궁금한 곳은 ${WONDER_MAX_OPEN}개까지 찍어 둘 수 있어요. 오래된 것을 지워 주세요.`);
  }
  const [w] = await db
    .insert(wonders)
    .values({ userId: user.id, lat, lng: lng as number, note })
    .returning({ id: wonders.id });
  return NextResponse.json({ id: w.id }, { status: 201 });
});
