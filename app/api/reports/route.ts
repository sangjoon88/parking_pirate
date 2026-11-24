import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { doubloonLogs, spotReports, spots } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { awardOnce, settleEarned } from "@/lib/doubloons";
import { boosted, bountyFor, REPORT_COOLDOWN_HOURS, REWARD } from "@/lib/game";
import { closeIfGateInstalled, parseReportInput } from "@/lib/reports";

/** 항해 일지 작성 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const spotId = typeof body.spotId === "string" ? body.spotId : "";
  // 사진만 올리는 일지도 허용 (사진은 일지를 만든 뒤 따로 올라온다)
  const { guardLevel, gateStatus, note } = parseReportInput(body, body.hasPhoto === true);

  const [spot] = await db.select().from(spots).where(eq(spots.id, spotId)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);

  const [report] = await db
    .insert(spotReports)
    .values({ spotId, userId: user.id, guardLevel, gateStatus, note })
    .returning({ id: spotReports.id });

  let earned = 0;
  let bounty = 0;
  // 일지 보상은 같은 정박지에 6시간에 한 번 (도배 방지, 동시에 여러 번 보내도 한 번)
  const amount = boosted("report", REWARD.report);
  if (await awardOnce(user.id, amount, "report", spotId, REPORT_COOLDOWN_HOURS)) earned += amount;

  let closed = false;
  if (gateStatus === "no_gate") {
    // 현상금: 오래 확인 안 된 정박지를 "그대로 없음"으로 확인하면 획득.
    // 행을 잠그고 "이전 확인 시각"을 읽은 뒤 갱신하고 장부까지 한 트랜잭션이라, 동시에 써도 한 명만 받는다.
    // 선원이 건 현상금도 함께 받아 가고 0으로 비운다. 이건 선원끼리 오간 돈이라 따로(bounty_posted) 기록한다
    // (내가 건 현상금을 내가 다시 가져가며 랭킹·추천인 몫을 불리는 것 방지).
    const got = await db.transaction(async (tx) => {
      const res = await tx.execute<{
        prev: Date | string | null;
        created_at: Date | string;
        status: "open" | "closed";
        posted: number | string;
      }>(sql`
        select last_confirmed_at as prev, created_at, status, posted_bounty as posted
        from spots where id = ${spotId} for update
      `);
      const old = res.rows[0];
      await tx.execute(sql`
        update spots set last_confirmed_at = now(),
          posted_bounty = case when status = 'open' then 0 else posted_bounty end
        where id = ${spotId}
      `);
      if (!old || old.status !== "open") return { time: 0, posted: 0 };
      const time = boosted("bounty", bountyFor(old.prev, old.created_at));
      const posted = Number(old.posted);
      const logs: (typeof doubloonLogs.$inferInsert)[] = [];
      if (time > 0) logs.push({ userId: user.id, amount: time, reason: "bounty", refId: spotId });
      if (posted > 0) logs.push({ userId: user.id, amount: posted, reason: "bounty_posted", refId: spotId });
      if (logs.length) await tx.insert(doubloonLogs).values(logs);
      return { time, posted };
    });
    if (got.time > 0) await settleEarned(user.id, got.time, "bounty");
    bounty = got.time + got.posted;
    earned += bounty;
  } else if (gateStatus === "gate_installed") {
    closed = await closeIfGateInstalled(spotId);
  }

  return NextResponse.json({ ok: true, id: report.id, closed, earned, bounty }, { status: 201 });
});
