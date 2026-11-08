import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { GUARD_AVG_DAYS, PARKING_MAX_HOURS } from "./constants";
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
  discoverer: string;
  parked_count: number | string;
  guard_avg: number | string | null;
};

const iso = (v: Date | string | null) => (v == null ? null : new Date(v).toISOString());

export async function listSpots(spotId?: string): Promise<SpotSummary[]> {
  const where = spotId ? sql`where s.id = ${spotId}` : sql``;
  const res = await db.execute<Row>(sql`
    select
      s.id, s.name, s.address, s.lat, s.lng, s.status,
      s.last_confirmed_at, s.created_at,
      u.nickname as discoverer,
      (select count(*)::int from parkings p
        where p.spot_id = s.id and p.ended_at is null
          and p.started_at > now() - make_interval(hours => ${PARKING_MAX_HOURS})) as parked_count,
      (select round(avg(r.guard_level)::numeric, 1)::float from spot_reports r
        where r.spot_id = s.id and r.guard_level is not null
          and r.created_at > now() - make_interval(days => ${GUARD_AVG_DAYS})) as guard_avg
    from spots s
    join users u on u.id = s.created_by
    ${where}
    order by s.created_at
  `);
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    lat: Number(r.lat),
    lng: Number(r.lng),
    status: r.status,
    lastConfirmedAt: iso(r.last_confirmed_at),
    createdAt: iso(r.created_at)!,
    discoverer: r.discoverer,
    parkedCount: Number(r.parked_count),
    guardAvg: r.guard_avg == null ? null : Number(r.guard_avg),
  }));
}
