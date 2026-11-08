import { NextResponse } from "next/server";
import { db } from "@/db";
import { spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { distanceMeters, DUPLICATE_SPOT_RADIUS_M, isValidCoord } from "@/lib/geo";
import { listSpots } from "@/lib/spots";

export const GET = handle(async () => {
  await requireUser();
  return NextResponse.json({ spots: await listSpots() });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 200) : null;
  const { lat, lng } = body;
  if (name.length < 2 || name.length > 40) bad("단지명은 2~40자로 입력해 주세요.");
  if (!isValidCoord(lat, lng)) bad("위치가 올바르지 않아요.");

  const all = await db.select({ id: spots.id, name: spots.name, lat: spots.lat, lng: spots.lng }).from(spots);
  const near = all
    .map((s) => ({ ...s, d: distanceMeters(lat, lng as number, s.lat, s.lng) }))
    .filter((s) => s.d <= DUPLICATE_SPOT_RADIUS_M)
    .sort((a, b) => a.d - b.d)[0];
  if (near) {
    return NextResponse.json(
      { error: "이미 등록된 정박지가 있어요.", existing: { id: near.id, name: near.name, lat: near.lat, lng: near.lng } },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(spots)
    .values({ name, address: address || null, lat, lng: lng as number, createdBy: user.id, lastConfirmedAt: new Date() })
    .returning({ id: spots.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
});
