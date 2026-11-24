import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { HttpError } from "./errors";
import { lineageShare } from "./game";
import { cellOf } from "./yeouido";

/**
 * 정박지 삭제 권한.
 * - 관리자: 언제든
 * - 발견자: 다른 선원이 정박하거나 일지를 남기지 않은 자기 정박지만 (남의 기록이 같이 사라지지 않게)
 */
export async function spotDeletePermission(
  spotId: string,
  user: { id: string; role: string },
): Promise<{ canDelete: boolean; reason: string | null; notFound?: boolean }> {
  const res = await db.execute<{ created_by: string; others: string | number }>(sql`
    select s.created_by,
      (select count(*) from parkings p where p.spot_id = s.id and p.user_id <> s.created_by)
      + (select count(*) from spot_reports r where r.spot_id = s.id and r.user_id <> s.created_by) as others
    from spots s where s.id = ${spotId}
  `);
  const s = res.rows[0];
  if (!s) return { canDelete: false, reason: "정박지를 찾을 수 없어요.", notFound: true };
  if (user.role === "admin") return { canDelete: true, reason: null };
  if (s.created_by !== user.id) return { canDelete: false, reason: "발견한 선원이나 관리자만 지울 수 있어요." };
  if (Number(s.others) > 0) return { canDelete: false, reason: "다른 선원의 정박·일지 기록이 있어서 관리자만 지울 수 있어요." };
  return { canDelete: true, reason: null };
}

export type SpotDeleteResult = {
  name: string;
  parkings: number;
  reports: number;
  photos: number;
  refundedStash: number;
  refundedBounty: number;
  revoked: number;
};

/**
 * 정박지와 딸린 기록을 한 트랜잭션에서 지운다.
 * - 묻힌 보물(아직 안 찾은 것)과 선원이 건 현상금은 건 사람에게 돌려준다
 * - 발견 보상(발견·새 해역)과 이곳으로 해결된 궁금한 곳 보상, 그 추천인 몫까지 회수한다 (등록·삭제 반복으로 금화 버는 것 방지)
 * - 정박·일지·사진·경비원 메모·오늘의 보물상자는 지우고, 이곳으로 해결된 궁금한 곳은 다시 미해결로
 * 금화 장부는 지우지 않고 기록을 더한다(지난 기록은 그대로).
 */
export async function deleteSpot(spotId: string): Promise<SpotDeleteResult> {
  return db.transaction(async (tx) => {
    const n = async (q: ReturnType<typeof sql>) => (await tx.execute(q)).rowCount ?? 0;
    const spotRes = await tx.execute<{
      name: string;
      created_by: string;
      posted_bounty: number;
      lat: number;
      lng: number;
      created_at: Date | string;
    }>(sql`select name, created_by, posted_bounty, lat, lng, created_at from spots where id = ${spotId} for update`);
    const spot = spotRes.rows[0];
    if (!spot) throw new HttpError(404, "이미 지워진 정박지예요.");

    // 묻힌 보물 환불
    const stashRes = await tx.execute<{ user_id: string; amount: number }>(
      sql`select user_id, amount from stashes where spot_id = ${spotId} and found_by is null`,
    );
    let refundedStash = 0;
    for (const s of stashRes.rows) {
      await tx.execute(
        sql`insert into doubloon_logs (user_id, amount, reason, ref_id) values (${s.user_id}, ${Number(s.amount)}, 'stash_refund', ${spotId})`,
      );
      refundedStash += Number(s.amount);
    }

    // 선원이 건 현상금 환불: 마지막으로 현상금이 지급된 뒤에 건 몫만 (지급되면 posted_bounty가 0으로 비워진다)
    let refundedBounty = 0;
    if (Number(spot.posted_bounty) > 0) {
      const posts = await tx.execute<{ user_id: string; amount: string | number }>(sql`
        select user_id, -sum(amount) as amount from doubloon_logs
        where reason = 'bounty_post' and ref_id = ${spotId}
          and created_at > coalesce((select max(created_at) from doubloon_logs where reason in ('bounty', 'bounty_posted') and ref_id = ${spotId}), 'epoch')
        group by user_id
      `);
      for (const p of posts.rows) {
        const amt = Number(p.amount);
        if (amt > 0) {
          await tx.execute(
            sql`insert into doubloon_logs (user_id, amount, reason, ref_id) values (${p.user_id}, ${amt}, 'bounty_refund', ${spotId})`,
          );
          refundedBounty += amt;
        }
      }
    }

    // 보상 회수 (등록·삭제 반복으로 금화·랭킹·추천인 몫을 버는 것 방지)
    // - 발견·새 해역(발견자), 이곳으로 해결된 궁금한 곳 보상(찍은 선원)
    // - 그 보상에 따라간 추천인 몫
    // 새 해역 보상은 예전에는 해역 id로 기록했다: 발견자가 등록 시각 앞뒤 1분 안에 받은 그 해역 보상으로 찾는다
    const cell = cellOf(Number(spot.lat), Number(spot.lng));
    const createdAt = new Date(spot.created_at).toISOString();
    const rewardRes = await tx.execute<{ user_id: string; amount: number; referrer_id: string | null }>(sql`
      select l.user_id, l.amount, u.referrer_id
      from doubloon_logs l join users u on u.id = l.user_id
      where l.amount > 0 and (
        (l.ref_id = ${spotId} and l.reason in ('discovery', 'new_cell', 'wonder_solved'))
        or (l.reason = 'new_cell' and l.ref_id = ${cell ?? ""} and l.user_id = ${spot.created_by}
          and l.created_at between ${createdAt}::timestamptz - interval '1 minute'
                               and ${createdAt}::timestamptz + interval '1 minute')
      )
    `);
    const back = new Map<string, number>();
    const take = (userId: string, amount: number) => back.set(userId, (back.get(userId) ?? 0) + amount);
    for (const r of rewardRes.rows) {
      take(r.user_id, Number(r.amount));
      if (r.referrer_id) take(r.referrer_id, lineageShare(Number(r.amount)));
    }
    const revoked = back.get(spot.created_by) ?? 0;
    for (const [userId, amount] of back) {
      if (amount > 0) {
        await tx.execute(
          sql`insert into doubloon_logs (user_id, amount, reason, ref_id) values (${userId}, ${-amount}, 'spot_deleted', ${spotId})`,
        );
      }
    }

    const photos = await n(
      sql`delete from photos where spot_id = ${spotId} or report_id in (select id from spot_reports where spot_id = ${spotId})`,
    );
    const reports = await n(sql`delete from spot_reports where spot_id = ${spotId}`);
    const parkings = await n(sql`delete from parkings where spot_id = ${spotId}`);
    await n(sql`delete from guard_contacts where spot_id = ${spotId}`);
    await n(sql`delete from stashes where spot_id = ${spotId}`);
    await n(sql`delete from daily_treasures where spot_id = ${spotId}`);
    await n(sql`update wonders set resolved_spot_id = null, resolved_at = null where resolved_spot_id = ${spotId}`);
    await n(sql`delete from spots where id = ${spotId}`);

    return { name: spot.name, parkings, reports, photos, refundedStash, refundedBounty, revoked };
  });
}
