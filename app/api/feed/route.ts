import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { handle, requireUser } from "@/lib/auth";
import type { FeedItem } from "@/lib/types";

const FEED_DAYS = 30;
const FEED_LIMIT = 80;

type Row = {
  kind: FeedItem["kind"];
  id: string;
  spot_id: string | null;
  spot_name: string | null;
  nickname: string;
  name_color: string | null;
  name_effect: string | null;
  created_at: Date | string;
  guard_level: number | null;
  gate_status: "no_gate" | "gate_installed" | null;
  note: string | null;
  photo_id: string | null;
  extra: Record<string, unknown> | null;
};

/**
 * 새 소식: 최근 30일의 정박지 발견, 항해 일지, 해전을 한 줄로 모아 최신순으로.
 * ?head=1 이면 가장 최근 글 시각만 (하단 탭의 '새 글' 점 표시용)
 */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const head = new URL(req.url).searchParams.get("head") === "1";
  const since = sql`now() - make_interval(days => ${FEED_DAYS})`;

  if (head) {
    const res = await db.execute<{ t: Date | string | null }>(sql`
      select greatest(
        (select max(created_at) from spots),
        (select max(created_at) from spot_reports),
        (select max(created_at) from battles)
      ) as t
    `);
    const t = res.rows[0]?.t;
    return NextResponse.json({ latest: t ? new Date(t).toISOString() : null });
  }

  const res = await db.execute<Row>(sql`
    select * from (
      select 'spot' as kind, s.id, s.id as spot_id, s.name as spot_name, u.nickname, u.name_color, u.name_effect,
        s.created_at, null::int as guard_level, null as gate_status, s.description as note, null::uuid as photo_id,
        null::jsonb as extra
      from spots s join users u on u.id = s.created_by
      where s.created_at > ${since}
      union all
      select 'report', r.id, r.spot_id, s.name, u.nickname, u.name_color, u.name_effect,
        r.created_at, r.guard_level, r.gate_status, r.note,
        (select p.id from photos p where p.report_id = r.id limit 1), null::jsonb
      from spot_reports r join users u on u.id = r.user_id join spots s on s.id = r.spot_id
      where r.created_at > ${since}
      union all
      select 'battle', b.id, null, null, au.nickname, au.name_color, au.name_effect,
        b.created_at, null, null, null, null,
        jsonb_build_object(
          'attacker', ac.name, 'defender', dc.name, 'defenderNick', du.nickname,
          'attackerWon', b.winner_id = b.attacker_id, 'independence', b.independence
        )
      from battles b
        join crews ac on ac.user_id = b.attacker_id join users au on au.id = b.attacker_id
        join crews dc on dc.user_id = b.defender_id join users du on du.id = b.defender_id
      where b.created_at > ${since}
    ) f
    order by created_at desc
    limit ${FEED_LIMIT}
  `);

  const items: FeedItem[] = res.rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    spotId: r.spot_id,
    spotName: r.spot_name,
    nickname: r.nickname,
    nameColor: r.name_color,
    nameEffect: r.name_effect,
    createdAt: new Date(r.created_at).toISOString(),
    guardLevel: r.guard_level,
    gateStatus: r.gate_status,
    note: r.note,
    photoId: r.photo_id,
    battle: r.extra as FeedItem["battle"],
  }));
  return NextResponse.json({ items });
});
