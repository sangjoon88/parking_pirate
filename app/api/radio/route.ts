import { and, desc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { radioMessages, users } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { RADIO_COOLDOWN_MINUTES, RADIO_MAX_LEN, RADIO_TTL_MINUTES } from "@/lib/game";
import { isValidCoord } from "@/lib/geo";

/** 무전기: 최근 1시간 쪽지 */
export const GET = handle(async () => {
  const user = await requireUser();
  const rows = await db
    .select({
      id: radioMessages.id,
      lat: radioMessages.lat,
      lng: radioMessages.lng,
      text: radioMessages.text,
      createdAt: radioMessages.createdAt,
      userId: radioMessages.userId,
      nickname: users.nickname,
    })
    .from(radioMessages)
    .innerJoin(users, eq(users.id, radioMessages.userId))
    .where(gt(radioMessages.createdAt, new Date(Date.now() - RADIO_TTL_MINUTES * 60_000)))
    .orderBy(desc(radioMessages.createdAt))
    .limit(50);
  return NextResponse.json({
    messages: rows.map(({ userId, ...m }) => ({ ...m, mine: userId === user.id })),
  });
});

/** 무전 보내기: 지도에서 고른 위치에 한 줄 (내 GPS 위치가 아니어도 됨) */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const { lat, lng } = body;
  if (!text) bad("무전 내용을 적어 주세요.");
  if (text.length > RADIO_MAX_LEN) bad(`무전은 ${RADIO_MAX_LEN}자까지예요.`);
  if (!isValidCoord(lat, lng)) bad("위치가 올바르지 않아요.");

  const [recent] = await db
    .select({ id: radioMessages.id })
    .from(radioMessages)
    .where(
      and(
        eq(radioMessages.userId, user.id),
        gt(radioMessages.createdAt, new Date(Date.now() - RADIO_COOLDOWN_MINUTES * 60_000)),
      ),
    )
    .limit(1);
  if (recent) bad(`무전은 ${RADIO_COOLDOWN_MINUTES}분에 한 번 보낼 수 있어요.`);

  await db.insert(radioMessages).values({ userId: user.id, lat, lng: lng as number, text });
  return NextResponse.json({ ok: true }, { status: 201 });
});
