import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { guardContacts, photos, spotReports, spots, users } from "@/db/schema";
import { bad, handle, readJson, requireAdmin, requireUser } from "@/lib/auth";
import { balanceOf } from "@/lib/doubloons";
import { deleteSpot, spotDeletePermission } from "@/lib/spotDelete";
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

  const [reports, spotPhotos, balance, guards, perm] = await Promise.all([
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
    spotDeletePermission(id, user),
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
    me: { id: user.id, balance, canDeleteSpot: perm.canDelete, isAdmin: user.role === "admin" },
  });
});

/** 정박지 삭제: 관리자, 또는 다른 선원 기록이 없는 자기 정박지의 발견자 */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("정박지를 찾을 수 없어요.", 404);
  const perm = await spotDeletePermission(id, user);
  if (!perm.canDelete) bad(perm.reason ?? "지울 수 없어요.", perm.notFound ? 404 : 403);
  const result = await deleteSpot(id);
  return NextResponse.json({ ok: true, ...result });
});

/**
 * 닫힌 정박지 다시 열기 (관리자). 확인 시각을 지금으로 바꿔서,
 * 이전의 "차단기 생김" 제보로 바로 다시 닫히지 않게 한다.
 */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("정박지를 찾을 수 없어요.", 404);
  const body = await readJson(req);
  if (body.status !== "open") bad("알 수 없는 요청이에요.");
  const opened = await db
    .update(spots)
    .set({ status: "open", lastConfirmedAt: sql`now()` })
    .where(and(eq(spots.id, id), eq(spots.status, "closed")))
    .returning({ name: spots.name });
  if (!opened.length) bad("닫힌 정박지가 아니에요.");
  return NextResponse.json({ ok: true, name: opened[0].name });
});
