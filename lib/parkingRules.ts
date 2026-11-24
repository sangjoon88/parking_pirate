import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PARKING_MAX_HOURS } from "./constants";
import { PARKING_RULE as R } from "./game";

/**
 * 인정된 정박 목록 (서브쿼리). `from ${COUNTED_PARKINGS} p` 처럼 쓴다. 열: id, user_id, spot_id, started_at, ended_at
 *  1. 3시간 이상 머문 정박 (끝 시각 = 출항 시각, 아직 정박 중이면 지금, 12시간 넘게 열려 있으면 시작+12시간)
 *  2. 같은 선원이 같은 정박지에 6시간 안에 다시 한 정박은 제외 (앞의 것만 인정)
 *  3. 한국 날짜 하루에 앞의 3번까지만
 * 지난 기록에도 그대로 적용된다 (집계할 때마다 계산).
 */
export const COUNTED_PARKINGS = sql`(
  with base as (
    select p.id, p.user_id, p.spot_id, p.started_at, p.ended_at,
      coalesce(p.ended_at, least(now(), p.started_at + make_interval(hours => ${PARKING_MAX_HOURS}))) as eff_end
    from parkings p
  ),
  long_enough as (
    select * from base where eff_end - started_at >= make_interval(hours => ${R.minHours})
  ),
  spaced as (
    select l.* from long_enough l
    where not exists (
      select 1 from long_enough e
      where e.user_id = l.user_id and e.spot_id = l.spot_id
        and e.started_at < l.started_at
        and e.started_at > l.started_at - make_interval(hours => ${R.sameSpotGapHours})
    )
  ),
  ranked as (
    select s.*, row_number() over (
      partition by s.user_id, (s.started_at at time zone 'Asia/Seoul')::date order by s.started_at
    ) as day_rank
    from spaced s
  )
  select id, user_id, spot_id, started_at, ended_at from ranked where day_rank <= ${R.dailyMax}
)`;

/** 이 정박이 인정됐는지, 아니면 왜 안 됐는지 (출항 안내용) */
export async function parkingVerdict(parkingId: string): Promise<{ counted: boolean; reason: string | null }> {
  const res = await db.execute<{ counted: boolean; hours: number; same_spot: boolean; day_count: string | number }>(sql`
    with me as (
      select p.*, coalesce(p.ended_at, least(now(), p.started_at + make_interval(hours => ${PARKING_MAX_HOURS}))) as eff_end
      from parkings p where p.id = ${parkingId}
    )
    select
      exists (select 1 from ${COUNTED_PARKINGS} c where c.id = me.id) as counted,
      extract(epoch from (me.eff_end - me.started_at)) / 3600 as hours,
      exists (
        select 1 from ${COUNTED_PARKINGS} c
        where c.user_id = me.user_id and c.spot_id = me.spot_id and c.id <> me.id
          and c.started_at < me.started_at and c.started_at > me.started_at - make_interval(hours => ${R.sameSpotGapHours})
      ) as same_spot,
      (select count(*) from ${COUNTED_PARKINGS} c
        where c.user_id = me.user_id and c.id <> me.id and c.started_at < me.started_at
          and (c.started_at at time zone 'Asia/Seoul')::date = (me.started_at at time zone 'Asia/Seoul')::date) as day_count
    from me
  `);
  const r = res.rows[0];
  if (!r) return { counted: false, reason: "정박 기록을 찾을 수 없어요." };
  if (r.counted) return { counted: true, reason: null };
  if (Number(r.hours) < R.minHours) return { counted: false, reason: `${R.minHours}시간 이상 머물러야 인정돼요` };
  if (r.same_spot) return { counted: false, reason: `같은 정박지는 ${R.sameSpotGapHours}시간이 지나야 다시 인정돼요` };
  if (Number(r.day_count) >= R.dailyMax) return { counted: false, reason: `하루 ${R.dailyMax}번까지만 인정돼요` };
  return { counted: false, reason: "인정 조건을 채우지 못했어요" };
}
