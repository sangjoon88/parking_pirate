import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { BADGES, type BadgeId } from "./game";

export type BadgeStatus = { id: BadgeId; icon: string; name: string; desc: string; earned: boolean; progress: string };

/** 한 선원의 배지 획득 현황 (기록에서 계산) */
export async function badgesFor(
  userId: string,
  opts: { isLord: boolean; createdAt: Date },
): Promise<BadgeStatus[]> {
  const [countsRes, daysRes] = await Promise.all([
    db.execute<Record<string, string | number>>(sql`
      select
        (select count(*) from spots where created_by = ${userId}) as discoveries,
        (select count(*) from spot_reports where user_id = ${userId}) as reports,
        (select count(*) from parkings where user_id = ${userId}
          and (extract(hour from started_at at time zone 'Asia/Seoul') >= 22
            or extract(hour from started_at at time zone 'Asia/Seoul') < 5)) as night,
        (select count(*) from doubloon_logs where user_id = ${userId} and reason = 'new_cell') as cells,
        (select count(*) from doubloon_logs where user_id = ${userId} and reason = 'fleet') as fleets,
        (select count(*) from doubloon_logs where user_id = ${userId} and reason = 'bounty') as bounties,
        (select count(*) from doubloon_logs where user_id = ${userId} and reason in ('treasure', 'stash_found')) as treasures,
        (select count(*) from doubloon_logs where user_id = ${userId} and reason = 'duel_win') as duel_wins
    `),
    db.execute<{ d: string }>(sql`
      select distinct to_char(started_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as d
      from parkings where user_id = ${userId} order by d
    `),
  ]);
  const c = Object.fromEntries(Object.entries(countsRes.rows[0] ?? {}).map(([k, v]) => [k, Number(v)]));

  // 최장 연속 정박 일수
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const { d } of daysRes.rows) {
    const t = Date.parse(d + "T00:00:00Z") / 86400_000;
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }

  const rule: Record<BadgeId, [number, number]> = {
    pioneer: [c.discoveries, 1],
    cartographer: [c.cells, 1],
    night: [c.night, 10],
    streak: [best, 7],
    fleet: [c.fleets, 1],
    hunter: [c.bounties, 3],
    scout: [c.reports, 20],
    lord: [opts.isLord ? 1 : 0, 1],
    treasure: [c.treasures, 1],
    duelist: [c.duel_wins, 1],
    veteran: [Math.floor((Date.now() - opts.createdAt.getTime()) / 86400_000), 100],
  };

  return (Object.keys(BADGES) as BadgeId[]).map((id) => {
    const [have, need] = rule[id];
    return { id, ...BADGES[id], earned: have >= need, progress: `${Math.min(have, need)}/${need}` };
  });
}
