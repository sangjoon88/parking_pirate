import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { photos, spotReports, users } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";
import { balanceOf } from "@/lib/doubloons";
import { listSpots } from "@/lib/spots";

const UUID = /^[0-9a-f-]{36}$/i;

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("정박지를 찾을 수 없어요.", 404);
  const {
    spots: [spot],
  } = await listSpots(id);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);

  const [reports, spotPhotos, balance] = await Promise.all([
    db
      .select({
        id: spotReports.id,
        guardLevel: spotReports.guardLevel,
        gateStatus: spotReports.gateStatus,
        note: spotReports.note,
        createdAt: spotReports.createdAt,
        nickname: users.nickname,
        photoId: photos.id,
      })
      .from(spotReports)
      .innerJoin(users, eq(users.id, spotReports.userId))
      .leftJoin(photos, eq(photos.reportId, spotReports.id))
      .where(eq(spotReports.spotId, id))
      .orderBy(desc(spotReports.createdAt))
      .limit(3),
    // 정박지 소개 사진 (사진 바이트는 빼고 목록만)
    db
      .select({
        id: photos.id,
        userId: photos.userId,
        nickname: users.nickname,
        createdAt: photos.createdAt,
        width: photos.width,
        height: photos.height,
      })
      .from(photos)
      .innerJoin(users, eq(users.id, photos.userId))
      .where(and(eq(photos.spotId, id), isNull(photos.reportId)))
      .orderBy(desc(photos.createdAt)),
    balanceOf(user.id),
  ]);

  return NextResponse.json({
    spot,
    reports,
    photos: spotPhotos.map(({ userId, ...p }) => ({ ...p, canDelete: userId === user.id || user.role === "admin" })),
    me: { id: user.id, balance },
  });
});
