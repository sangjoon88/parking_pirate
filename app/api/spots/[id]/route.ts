import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spotReports, users } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";
import { listSpots } from "@/lib/spots";

const UUID = /^[0-9a-f-]{36}$/i;

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("정박지를 찾을 수 없어요.", 404);
  const [spot] = await listSpots(id);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);

  const reports = await db
    .select({
      id: spotReports.id,
      guardLevel: spotReports.guardLevel,
      gateStatus: spotReports.gateStatus,
      note: spotReports.note,
      createdAt: spotReports.createdAt,
      nickname: users.nickname,
    })
    .from(spotReports)
    .innerJoin(users, eq(users.id, spotReports.userId))
    .where(eq(spotReports.spotId, id))
    .orderBy(desc(spotReports.createdAt))
    .limit(3);

  return NextResponse.json({ spot, reports });
});
