import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { guardContacts, photos, spotReports, users } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";
import { balanceOf } from "@/lib/doubloons";
import { listSpots } from "@/lib/spots";

const UUID = /^[0-9a-f-]{36}$/i;
/** 시트에 내려보내는 항해 일지 수 (선원 20명 규모라 사실상 전부) */
const REPORT_LIST_MAX = 200;

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("정박지를 찾을 수 없어요.", 404);
  const {
    spots: [spot],
  } = await listSpots(id);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);

  const [reports, spotPhotos, balance, guards] = await Promise.all([
    db
      .select({
        id: spotReports.id,
        guardLevel: spotReports.guardLevel,
        gateStatus: spotReports.gateStatus,
        note: spotReports.note,
        createdAt: spotReports.createdAt,
        updatedAt: spotReports.updatedAt,
        userId: spotReports.userId,
        nickname: users.nickname,
        photoId: photos.id,
      })
      .from(spotReports)
      .innerJoin(users, eq(users.id, spotReports.userId))
      .leftJoin(photos, eq(photos.reportId, spotReports.id))
      .where(eq(spotReports.spotId, id))
      .orderBy(desc(spotReports.createdAt))
      .limit(REPORT_LIST_MAX),
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
    db
      .select({
        id: guardContacts.id,
        label: guardContacts.label,
        digits: guardContacts.digits,
        userId: guardContacts.userId,
        nickname: users.nickname,
        createdAt: guardContacts.createdAt,
      })
      .from(guardContacts)
      .innerJoin(users, eq(users.id, guardContacts.userId))
      .where(eq(guardContacts.spotId, id))
      .orderBy(asc(guardContacts.createdAt)),
  ]);

  return NextResponse.json({
    spot,
    reports: reports.map(({ userId, ...r }) => ({
      ...r,
      mine: userId === user.id,
      canDelete: userId === user.id || user.role === "admin",
    })),
    photos: spotPhotos.map(({ userId, ...p }) => ({ ...p, canDelete: userId === user.id || user.role === "admin" })),
    guards: guards.map(({ userId, ...g }) => ({ ...g, canDelete: userId === user.id || user.role === "admin" })),
    me: { id: user.id, balance },
  });
});
