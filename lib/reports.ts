import "server-only";
import { and, countDistinct, eq } from "drizzle-orm";
import { db } from "@/db";
import { spotReports, spots } from "@/db/schema";
import { bad } from "@/lib/auth";
import { GATE_CLOSE_THRESHOLD, NOTE_MAX } from "@/lib/constants";

export type ReportInput = {
  guardLevel: number | null;
  gateStatus: "no_gate" | "gate_installed" | null;
  note: string;
};

/** 일지 입력값 검사 (쓰기·고치기 공통). hasPhoto: 사진만 있는 일지도 허용 */
export function parseReportInput(body: Record<string, unknown>, hasPhoto: boolean): ReportInput {
  const guardLevel = body.guardLevel == null ? null : Number(body.guardLevel);
  const gateStatus = body.gateStatus === "no_gate" || body.gateStatus === "gate_installed" ? body.gateStatus : null;
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (guardLevel !== null && !(Number.isInteger(guardLevel) && guardLevel >= 1 && guardLevel <= 5)) {
    bad("경계 레벨은 1~5 중에서 골라 주세요.");
  }
  if (note.length > NOTE_MAX) bad(`메모는 ${NOTE_MAX}자까지 쓸 수 있어요.`);
  if (guardLevel === null && gateStatus === null && !note && !hasPhoto) {
    bad("경계 레벨, 차단기 상태, 메모, 사진 중 하나는 남겨 주세요.");
  }
  return { guardLevel, gateStatus, note };
}

/** "차단기 생김"을 서로 다른 선원 2명 이상이 제보하면 정박지를 닫는다. 닫았으면 true */
export async function closeIfGateInstalled(spotId: string): Promise<boolean> {
  // 한 사람이 여러 번 써도 1건으로
  const [row] = await db
    .select({ n: countDistinct(spotReports.userId) })
    .from(spotReports)
    .where(and(eq(spotReports.spotId, spotId), eq(spotReports.gateStatus, "gate_installed")));
  if ((row?.n ?? 0) < GATE_CLOSE_THRESHOLD) return false;
  const closed = await db
    .update(spots)
    .set({ status: "closed" })
    .where(and(eq(spots.id, spotId), eq(spots.status, "open")))
    .returning({ id: spots.id });
  return closed.length > 0;
}
