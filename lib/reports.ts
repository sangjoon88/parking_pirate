import "server-only";
import { and, eq, sql, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { spots, users } from "@/db/schema";
import { bad } from "@/lib/auth";
import { GATE_CLOSE_THRESHOLD, NOTE_MAX, PARKING_MAX_HOURS } from "@/lib/constants";

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

/**
 * 두 선원이 같은 계보인지: 한쪽이 다른 쪽을 (몇 단계를 거쳐서든) 데려왔거나, 같은 추천인에게서 왔다.
 * 관리자가 데려온 선원끼리는 형제로 보지 않는다 (초기 선원 대부분이 관리자 추천이라).
 * 부계정을 데려와 혼자서 정박지를 닫는 것을 막는 데 쓴다.
 */
function sameLineage(
  a: string,
  b: string,
  referrerOf: Map<string, string | null>,
  admins: Set<string>,
): boolean {
  const ancestors = (id: string) => {
    const out = new Set<string>();
    for (let cur = referrerOf.get(id) ?? null; cur && !out.has(cur); cur = referrerOf.get(cur) ?? null) out.add(cur);
    return out;
  };
  const ra = referrerOf.get(a) ?? null;
  const rb = referrerOf.get(b) ?? null;
  return ancestors(a).has(b) || ancestors(b).has(a) || (!!ra && ra === rb && !admins.has(ra));
}

/**
 * "차단기 생김"이 마지막 "그대로 없음" 확인(또는 관리자가 다시 연 시각) 뒤로
 * 서로 다른 계보의 선원 2명 이상에게서 나오면 정박지를 닫는다. 관리자 제보는 혼자서도 닫는다. 닫았으면 true
 */
export async function closeIfGateInstalled(spotId: string): Promise<boolean> {
  const res = await db.execute<{ user_id: string; role: string }>(sql`
    select distinct r.user_id, u.role
    from spot_reports r
    join spots s on s.id = r.spot_id
    join users u on u.id = r.user_id and u.status = 'active'
    where r.spot_id = ${spotId} and r.gate_status = 'gate_installed'
      and coalesce(r.updated_at, r.created_at) > coalesce(s.last_confirmed_at, s.created_at)
  `);
  const reporters = res.rows;
  let enough = reporters.some((r) => r.role === "admin");
  if (!enough && reporters.length >= GATE_CLOSE_THRESHOLD) {
    const all = await db.select({ id: users.id, referrerId: users.referrerId, role: users.role }).from(users);
    const referrerOf = new Map(all.map((u) => [u.id, u.referrerId]));
    const admins = new Set(all.filter((u) => u.role === "admin").map((u) => u.id));
    enough = reporters.some((a, i) =>
      reporters.slice(i + 1).some((b) => !sameLineage(a.user_id, b.user_id, referrerOf, admins)),
    );
  }
  if (!enough) return false;
  const closed = await db
    .update(spots)
    .set({ status: "closed" })
    .where(and(eq(spots.id, spotId), eq(spots.status, "open")))
    .returning({ id: spots.id });
  return closed.length > 0;
}

/**
 * 해군 출몰 경보로 치는 경계 5 제보인지: 쓴 선원이 그때 그 정박지에 정박 중이었거나 1시간 안에 출항했어야 한다.
 * 일지는 어디서든 쓸 수 있지만, 경보(빨간 배너·진동)는 현장에 있던 선원만 울릴 수 있게 한다.
 */
export function navyAlertReporterParked(r: { userId: SQLWrapper; spotId: SQLWrapper; createdAt: SQLWrapper }) {
  return sql`exists (
    select 1 from parkings ap
    where ap.user_id = ${r.userId} and ap.spot_id = ${r.spotId}
      and ap.started_at <= ${r.createdAt}
      and coalesce(ap.ended_at, ap.started_at + make_interval(hours => ${PARKING_MAX_HOURS})) >= ${r.createdAt} - interval '1 hour'
  )`;
}
