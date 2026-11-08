import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { LORD_MIN_PARKINGS, LORD_WINDOW_DAYS } from "./game";

export type Lord = { userId: string; nickname: string; flag: string; count: number };

/** 정박지별 영주: 최근 30일 정박 횟수 1위 (2회 이상). 동점이면 마지막 정박이 더 이른 쪽(먼저 자리 잡은 쪽) */
export async function lordsBySpot(spotId?: string): Promise<Map<string, Lord>> {
  const filter = spotId ? sql`and p.spot_id = ${spotId}` : sql``;
  const res = await db.execute<{ spot_id: string; user_id: string; nickname: string; flag: string; n: number | string }>(sql`
    select distinct on (c.spot_id) c.spot_id, c.user_id, u.nickname, u.flag, c.n
    from (
      select p.spot_id, p.user_id, count(*) as n, max(p.started_at) as last_at
      from parkings p
      where p.started_at > now() - make_interval(days => ${LORD_WINDOW_DAYS}) ${filter}
      group by p.spot_id, p.user_id
      having count(*) >= ${LORD_MIN_PARKINGS}
    ) c
    join users u on u.id = c.user_id and u.status = 'active'
    order by c.spot_id, c.n desc, c.last_at asc
  `);
  return new Map(
    res.rows.map((r) => [r.spot_id, { userId: r.user_id, nickname: r.nickname, flag: r.flag, count: Number(r.n) }]),
  );
}
