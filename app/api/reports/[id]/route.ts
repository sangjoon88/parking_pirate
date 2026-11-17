import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { photos, spotReports } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { closeIfGateInstalled, parseReportInput } from "@/lib/reports";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * 항해 일지 고치기 (쓴 선원만).
 * 금화·현상금·확인 시각은 처음 쓸 때만 정해지고, 고쳐도 다시 주거나 바꾸지 않는다.
 * "차단기 생김"으로 고치면 닫힘 조건은 다시 확인한다.
 */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("항해 일지를 찾을 수 없어요.", 404);
  const body = await readJson(req);

  const [report] = await db
    .select({ userId: spotReports.userId, spotId: spotReports.spotId })
    .from(spotReports)
    .where(eq(spotReports.id, id))
    .limit(1);
  if (!report) bad("항해 일지를 찾을 수 없어요.", 404);
  if (report.userId !== user.id) bad("내가 쓴 일지만 고칠 수 있어요.", 403);

  const input = parseReportInput(body, body.hasPhoto === true);
  await db
    .update(spotReports)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(spotReports.id, id));

  const closed = input.gateStatus === "gate_installed" ? await closeIfGateInstalled(report.spotId) : false;
  return NextResponse.json({ ok: true, closed });
});

/**
 * 항해 일지 지우기 (쓴 선원 또는 관리자). 붙은 사진도 함께 지운다.
 * 이미 받은 금화·현상금은 그대로 두고, 닫힌 정박지도 다시 열지 않는다.
 */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!UUID.test(id)) bad("항해 일지를 찾을 수 없어요.", 404);

  const [report] = await db
    .select({ userId: spotReports.userId })
    .from(spotReports)
    .where(eq(spotReports.id, id))
    .limit(1);
  if (!report) bad("이미 지워진 일지예요.", 404);
  if (report.userId !== user.id && user.role !== "admin") bad("쓴 선원만 지울 수 있어요.", 403);

  await db.transaction(async (tx) => {
    await tx.delete(photos).where(eq(photos.reportId, id));
    await tx.delete(spotReports).where(eq(spotReports.id, id));
  });
  return NextResponse.json({ ok: true });
});
