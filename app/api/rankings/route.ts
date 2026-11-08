import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { handle, requireUser } from "@/lib/auth";
import { MONTH_START_KST } from "@/lib/doubloons";

type Row = { user_id: string; nickname: string; score: string | number };

async function top(query: ReturnType<typeof sql>) {
  const res = await db.execute<Row>(query);
  return res.rows.map((r) => ({ userId: r.user_id, nickname: r.nickname, score: Number(r.score) }));
}

/** 이번 달(한국 시간) 해적 랭킹 */
export const GET = handle(async () => {
  await requireUser();
  const [gold, discover, scout, regular] = await Promise.all([
    top(sql`
      select u.id as user_id, u.nickname, sum(l.amount) as score
      from doubloon_logs l join users u on u.id = l.user_id
      where l.created_at >= ${MONTH_START_KST} and u.status = 'active'
      group by u.id, u.nickname having sum(l.amount) > 0
      order by score desc, min(l.created_at) asc limit 5`),
    top(sql`
      select u.id as user_id, u.nickname, count(*) as score
      from spots s join users u on u.id = s.created_by
      where s.created_at >= ${MONTH_START_KST} and u.status = 'active'
      group by u.id, u.nickname order by score desc, min(s.created_at) asc limit 5`),
    top(sql`
      select u.id as user_id, u.nickname, count(*) as score
      from spot_reports r join users u on u.id = r.user_id
      where r.created_at >= ${MONTH_START_KST} and u.status = 'active'
      group by u.id, u.nickname order by score desc, min(r.created_at) asc limit 5`),
    top(sql`
      select u.id as user_id, u.nickname, count(*) as score
      from parkings p join users u on u.id = p.user_id
      where p.started_at >= ${MONTH_START_KST} and u.status = 'active'
      group by u.id, u.nickname order by score desc, min(p.started_at) asc limit 5`),
  ]);
  return NextResponse.json({ gold, discover, scout, regular });
});
