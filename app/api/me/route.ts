import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { parkings, spots } from "@/db/schema";
import { handle, requireUser } from "@/lib/auth";
import { closeStaleParkings } from "@/lib/parking";

export const GET = handle(async () => {
  const user = await requireUser();
  await closeStaleParkings(user.id);
  const history = await db
    .select({
      id: parkings.id,
      spotName: spots.name,
      startedAt: parkings.startedAt,
      endedAt: parkings.endedAt,
    })
    .from(parkings)
    .innerJoin(spots, eq(spots.id, parkings.spotId))
    .where(eq(parkings.userId, user.id))
    .orderBy(desc(parkings.startedAt))
    .limit(20);
  return NextResponse.json({
    user: { id: user.id, nickname: user.nickname, role: user.role, createdAt: user.createdAt },
    history,
  });
});
