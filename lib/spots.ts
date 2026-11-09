import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { GUARD_AVG_DAYS, PARKING_MAX_HOURS } from "./constants";
import { currentKingId } from "./doubloons";
import { boosted, bountyFor, LEGEND_PARKINGS, NAVY_ALERT_MINUTES, weatherFor } from "./game";
import { lordsBySpot } from "./lords";
import { hasStash, todayTreasure } from "./treasure";
import type { SpotSummary } from "./types";

type Row = {
  id: string;
  name: string;
  nickname: string | null;
  address: string | null;
  lat: number;
  lng: number;
  status: "open" | "closed";
  posted_bounty: number | string;
  description: string | null;
  description_at: Date | string | null;
  description_by: string | null;
  last_confirmed_at: Date | string | null;
  created_at: Date | string;
  created_by: string;
  discoverer: string;
  parked_count: number | string;
  total_parkings: number | string;
  guard_avg: number | string | null;
  alert_at: Date | string | null;
  alert_by: string | null;
};

const iso = (v: Date | string | null) => (v == null ? null : new Date(v).toISOString());

/** 현상금 = 시간 현상금(날씨 배율) + 선원이 건 현상금 */
export function totalBounty(s: {
  status: string;
  lastConfirmedAt: Date | string | null;
  createdAt: Date | string;
  postedBounty: number;
}) {
  if (s.status !== "open") return 0;
  return boosted("bounty", bountyFor(s.lastConfirmedAt, s.createdAt)) + s.postedBounty;
}

export async function listSpots(spotId?: string) {
  const where = spotId ? sql`where s.id = ${spotId}` : sql``;
  const [res, kingId, lords, treasure] = await Promise.all([
    db.execute<Row>(sql`
      select
        s.id, s.name, s.nickname, s.address, s.lat, s.lng, s.status, s.posted_bounty,
        s.description, s.description_at, (select nickname from users du where du.id = s.description_by) as description_by,
        s.last_confirmed_at, s.created_at, s.created_by,
        u.nickname as discoverer,
        (select count(*)::int from parkings p
          where p.spot_id = s.id and p.ended_at is null
            and p.started_at > now() - make_interval(hours => ${PARKING_MAX_HOURS})) as parked_count,
        (select count(*)::int from parkings p where p.spot_id = s.id) as total_parkings,
        (select round(avg(r.guard_level)::numeric, 1)::float from spot_reports r
          where r.spot_id = s.id and r.guard_level is not null
            and r.created_at > now() - make_interval(days => ${GUARD_AVG_DAYS})) as guard_avg,
        alert.created_at as alert_at,
        alert.nickname as alert_by
      from spots s
      join users u on u.id = s.created_by
      left join lateral (
        select r.created_at, ru.nickname from spot_reports r join users ru on ru.id = r.user_id
        where r.spot_id = s.id and r.guard_level = 5
          and r.created_at > now() - make_interval(mins => ${NAVY_ALERT_MINUTES})
        order by r.created_at desc limit 1
      ) alert on true
      ${where}
      order by s.created_at
    `),
    currentKingId(),
    lordsBySpot(spotId),
    todayTreasure(),
  ]);
  const stashSpots = await hasStash(res.rows.map((r) => r.id));

  const spots: SpotSummary[] = res.rows.map((r) => {
    const lastConfirmedAt = iso(r.last_confirmed_at);
    const createdAt = iso(r.created_at)!;
    const totalParkings = Number(r.total_parkings);
    return {
      id: r.id,
      name: r.name,
      nickname: r.nickname,
      address: r.address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      status: r.status,
      lastConfirmedAt,
      createdAt,
      discoverer: r.discoverer,
      discovererIsKing: !!kingId && r.created_by === kingId,
      parkedCount: Number(r.parked_count),
      totalParkings,
      legendary: totalParkings >= LEGEND_PARKINGS,
      guardAvg: r.guard_avg == null ? null : Number(r.guard_avg),
      bounty: totalBounty({ status: r.status, lastConfirmedAt, createdAt, postedBounty: Number(r.posted_bounty) }),
      postedBounty: Number(r.posted_bounty),
      description: r.description,
      descriptionBy: r.description_by,
      descriptionAt: iso(r.description_at),
      navyAlert: r.alert_at ? { at: iso(r.alert_at)!, by: r.alert_by ?? "" } : null,
      lord: lords.get(r.id) ?? null,
      treasure: !!treasure && treasure.spotId === r.id && !treasure.claimedBy ? treasure.amount : 0,
      stashRumor: stashSpots.has(r.id),
    };
  });
  return { spots, kingId, weather: weatherFor() };
}
