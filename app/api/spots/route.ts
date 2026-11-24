import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { distanceMeters, DUPLICATE_SPOT_RADIUS_M, isValidCoord } from "@/lib/geo";
import { award } from "@/lib/doubloons";
import { DESCRIPTION_MAX, REWARD } from "@/lib/game";
import { resolveWondersNear } from "@/lib/wonders";
import { listSpots } from "@/lib/spots";
import { cellOf, isInYeouido } from "@/lib/yeouido";

export const GET = handle(async () => {
  await requireUser();
  return NextResponse.json(await listSpots());
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 200) : null;
  const { lat, lng } = body;
  if (name.length < 2 || name.length > 40) bad("단지명은 2~40자로 입력해 주세요.");
  if (!isValidCoord(lat, lng)) bad("위치가 올바르지 않아요.");
  if (!isInYeouido(lat, lng as number)) bad("정박지는 여의도 안에서만 등록할 수 있어요.");

  const description = typeof body.description === "string" ? body.description.trim().slice(0, DESCRIPTION_MAX) : "";

  // 중복 검사와 등록을 잠금 안에서 (동시에 두 번 눌러 100m 안에 두 개 생기는 것 방지)
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('spots:create'))`);
    const all = await tx.select({ id: spots.id, name: spots.name, lat: spots.lat, lng: spots.lng }).from(spots);
    const near = all
      .map((s) => ({ ...s, d: distanceMeters(lat, lng as number, s.lat, s.lng) }))
      .filter((s) => s.d <= DUPLICATE_SPOT_RADIUS_M)
      .sort((a, b) => a.d - b.d)[0];
    if (near) return { near } as const;

    const now = new Date();
    const [created] = await tx
      .insert(spots)
      .values({
        name,
        address: address || null,
        lat,
        lng: lng as number,
        createdBy: user.id,
        lastConfirmedAt: now,
        ...(description ? { description, descriptionBy: user.id, descriptionAt: now } : {}),
      })
      .returning({ id: spots.id });
    const cell = cellOf(lat, lng as number);
    const newCell = !!cell && !all.some((s) => cellOf(s.lat, s.lng) === cell);
    return { created, newCell } as const;
  });
  if ("near" in result && result.near) {
    const { near } = result;
    return NextResponse.json(
      { error: "이미 등록된 정박지가 있어요.", existing: { id: near.id, name: near.name, lat: near.lat, lng: near.lng } },
      { status: 409 },
    );
  }
  const { created, newCell } = result;

  // 발견 보상 + 해도의 새 해역이면 추가 보상
  await award(user.id, REWARD.discovery, "discovery", created.id);
  // 새 해역 보상도 정박지 id로 기록 (정박지를 지우면 같이 회수)
  if (newCell) await award(user.id, REWARD.newCell, "new_cell", created.id);

  // 근처에 찍혀 있던 궁금한 곳(❓) 해결
  const wondersSolved = await resolveWondersNear({ id: created.id, lat, lng: lng as number }, user.id);

  return NextResponse.json(
    { id: created.id, earned: REWARD.discovery + (newCell ? REWARD.newCell : 0), newCell, wondersSolved },
    { status: 201 },
  );
});
