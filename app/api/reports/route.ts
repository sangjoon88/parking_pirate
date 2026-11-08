import { and, countDistinct, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spotReports, spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { GATE_CLOSE_THRESHOLD, NOTE_MAX } from "@/lib/constants";

/** 항해 일지 작성 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const spotId = typeof body.spotId === "string" ? body.spotId : "";
  const guardLevel = body.guardLevel == null ? null : Number(body.guardLevel);
  const gateStatus = body.gateStatus === "no_gate" || body.gateStatus === "gate_installed" ? body.gateStatus : null;
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (guardLevel !== null && !(Number.isInteger(guardLevel) && guardLevel >= 1 && guardLevel <= 5)) {
    bad("경계 레벨은 1~5 중에서 골라 주세요.");
  }
  if (note.length > NOTE_MAX) bad(`메모는 ${NOTE_MAX}자까지 쓸 수 있어요.`);
  if (guardLevel === null && gateStatus === null && !note) bad("경계 레벨, 차단기 상태, 메모 중 하나는 남겨 주세요.");

  const [spot] = await db.select({ id: spots.id }).from(spots).where(eq(spots.id, spotId)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);

  await db.insert(spotReports).values({ spotId, userId: user.id, guardLevel, gateStatus, note });

  let closed = false;
  if (gateStatus === "no_gate") {
    await db.update(spots).set({ lastConfirmedAt: new Date() }).where(eq(spots.id, spotId));
  } else if (gateStatus === "gate_installed") {
    // 한 사람이 여러 번 써도 1건으로: 서로 다른 선원 2명 이상이 제보하면 closed
    const [row] = await db
      .select({ n: countDistinct(spotReports.userId) })
      .from(spotReports)
      .where(and(eq(spotReports.spotId, spotId), eq(spotReports.gateStatus, "gate_installed")));
    if ((row?.n ?? 0) >= GATE_CLOSE_THRESHOLD) {
      await db.update(spots).set({ status: "closed" }).where(eq(spots.id, spotId));
      closed = true;
    }
  }

  return NextResponse.json({ ok: true, closed }, { status: 201 });
});
