import { and, countDistinct, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { spotReports, spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { GATE_CLOSE_THRESHOLD, NOTE_MAX } from "@/lib/constants";
import { award, awardedRecently } from "@/lib/doubloons";
import { boosted, REPORT_COOLDOWN_HOURS, REWARD } from "@/lib/game";
import { totalBounty } from "@/lib/spots";

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
  // 사진만 올리는 일지도 허용 (사진은 일지를 만든 뒤 따로 올라온다)
  const hasPhoto = body.hasPhoto === true;
  if (guardLevel === null && gateStatus === null && !note && !hasPhoto) {
    bad("경계 레벨, 차단기 상태, 메모, 사진 중 하나는 남겨 주세요.");
  }

  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);

  // 일지 보상은 같은 정박지에 6시간에 한 번 (도배 방지)
  const alreadyRewarded = await awardedRecently(user.id, "report", REPORT_COOLDOWN_HOURS, spotId);

  const [report] = await db
    .insert(spotReports)
    .values({ spotId, userId: user.id, guardLevel, gateStatus, note })
    .returning({ id: spotReports.id });

  let earned = 0;
  let bounty = 0;
  if (!alreadyRewarded) {
    const amount = boosted("report", REWARD.report);
    await award(user.id, amount, "report", spotId);
    earned += amount;
  }

  let closed = false;
  if (gateStatus === "no_gate") {
    // 현상금: 오래 확인 안 된 정박지를 "그대로 없음"으로 확인하면 획득.
    // 행을 잠그고 "이전 확인 시각"을 읽으면서 갱신하는 한 문장이라, 동시에 써도 한 명만 받는다.
    // 선원이 건 현상금도 함께 받아 가고 0으로 비운다.
    const res = await db.execute<{
      prev: Date | string | null;
      created_at: Date | string;
      status: "open" | "closed";
      posted: number | string;
    }>(sql`
      with old as (
        select last_confirmed_at as prev, created_at, status, posted_bounty as posted
        from spots where id = ${spotId} for update
      )
      update spots s set last_confirmed_at = now(),
        posted_bounty = case when old.status = 'open' then 0 else s.posted_bounty end
      from old where s.id = ${spotId}
      returning old.prev, old.created_at, old.status, old.posted
    `);
    const old = res.rows[0];
    const due = old
      ? totalBounty({
          status: old.status,
          lastConfirmedAt: old.prev,
          createdAt: old.created_at,
          postedBounty: Number(old.posted),
        })
      : 0;
    if (due > 0) {
      await award(user.id, due, "bounty", spotId);
      bounty = due;
      earned += due;
    }
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

  return NextResponse.json({ ok: true, id: report.id, closed, earned, bounty }, { status: 201 });
});
