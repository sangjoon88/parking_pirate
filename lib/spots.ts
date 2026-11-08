import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { GUARD_AVG_DAYS, PARKING_MAX_HOURS } from "./constants";
import { currentKingId } from "./doubloons";
import { bountyFor, NAVY_ALERT_MINUTES } from "./game";
import type { SpotSummary } from "./types";

type Row = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  status: "open" | "closed";
  last_confirmed_at: Date | string | null;
  created_at: Date | string;
  created_by: string;
  discoverer: string;
  parked_count: number | string;
  guard_avg: number | string | null;
  alert_at: Date | string | null;
  alert_by: string | null;
};

const iso = (v: Date | string | null) => (v == null ? null : new Date(v).toISOString());

export async function listSpots(spotId?: string): Promise<{ spots: SpotSummary[]; kingId: string | null }> {
  const where = spotId ? sql`where s.id = ${spotId}` : sql``;
  const [res, kingId] = await Promise.all([
    db.execute<Row>(sql`
      select
        s.id, s.name, s.address, s.lat, s.lng, s.status,
        s.last_confirmed_at, s.created_at, s.created_by,
        u.nickname as discoverer,
        (select count(*)::int from parkings p
          where p.spot_id = s.id and p.ended_at is null
            and p.started_at > now() - make_interval(hours => ${PARKING_MAX_HOURS})) as parked_count,
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
  ]);

  const now = Date.now();
  const spots = res.rows.map((r) => {
    const status = r.status;
    const lastConfirmedAt = iso(r.last_confirmed_at);
    const createdAt = iso(r.created_at)!;
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      status,
      lastConfirmedAt,
      createdAt,
      discoverer: r.discoverer,
      discovererIsKing: !!kingId && r.created_by === kingId,
      parkedCount: Number(r.parked_count),
      guardAvg: r.guard_avg == null ? null : Number(r.guard_avg),
      bounty: status === "open" ? bountyFor(lastConfirmedAt, createdAt, now) : 0,
      navyAlert: r.alert_at ? { at: iso(r.alert_at)!, by: r.alert_by ?? "" } : null,
    };
  });
  return { spots, kingId };
}
