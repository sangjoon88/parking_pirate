import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { currentHp, NAVAL, statsOf, type CrewStats, type Loadout, type NpcRole } from "./naval";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = Pick<typeof db, "execute"> | Tx;

export type CrewRow = {
  userId: string;
  name: string;
  shipTier: number;
  hp: number;
  hpAt: Date;
  overlordId: string | null;
  vassalUntil: Date | null;
  vassalBattleId: string | null;
  tributeRate: number;
  protectedUntil: Date | null;
  createdAt: Date;
  nickname: string;
  flag: string;
  nameColor: string | null;
  nameEffect: string | null;
  userStatus: "active" | "banned";
};

export type CrewFull = CrewRow & { loadout: Loadout; stats: CrewStats; hpNow: number; wins: number; losses: number };

const d = (v: Date | string | null) => (v == null ? null : new Date(v));

/** 해적단 전부 (선원 20명 규모라 한 번에 읽는다). userIds를 주면 그 해적단만 */
export async function loadCrews(exec: Exec = db, userIds?: string[]): Promise<Map<string, CrewFull>> {
  const only = userIds ? sql`where c.user_id in (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})` : sql``;
  const [crewRes, itemRes, npcRes, recordRes] = await Promise.all([
    exec.execute<Record<string, unknown>>(sql`
      select c.*, u.nickname, u.flag, u.name_color, u.name_effect, u.status as user_status
      from crews c join users u on u.id = c.user_id ${only}
      order by c.created_at
    `),
    exec.execute<{ user_id: string; item_id: string; qty: number }>(sql`select user_id, item_id, qty from crew_items where qty > 0`),
    exec.execute<{ user_id: string; role: string; level: number }>(sql`select user_id, role, level from crew_npcs`),
    exec.execute<{ id: string; wins: string | number; losses: string | number }>(sql`
      select c.user_id as id,
        (select count(*) from battles b where b.winner_id = c.user_id) as wins,
        (select count(*) from battles b where (b.attacker_id = c.user_id or b.defender_id = c.user_id) and b.winner_id <> c.user_id) as losses
      from crews c
    `),
  ]);
  const items = new Map<string, Record<string, number>>();
  for (const r of itemRes.rows) items.set(r.user_id, { ...(items.get(r.user_id) ?? {}), [r.item_id]: Number(r.qty) });
  const npcs = new Map<string, Partial<Record<NpcRole, number>>>();
  for (const r of npcRes.rows) npcs.set(r.user_id, { ...(npcs.get(r.user_id) ?? {}), [r.role as NpcRole]: Number(r.level) });
  const records = new Map(recordRes.rows.map((r) => [r.id, { wins: Number(r.wins), losses: Number(r.losses) }]));

  const out = new Map<string, CrewFull>();
  const now = Date.now();
  for (const r of crewRes.rows) {
    const row: CrewRow = {
      userId: r.user_id as string,
      name: r.name as string,
      shipTier: Number(r.ship_tier),
      hp: Number(r.hp),
      hpAt: d(r.hp_at as string)!,
      overlordId: (r.overlord_id as string) ?? null,
      vassalUntil: d(r.vassal_until as string | null),
      vassalBattleId: (r.vassal_battle_id as string) ?? null,
      tributeRate: Number(r.tribute_rate),
      protectedUntil: d(r.protected_until as string | null),
      createdAt: d(r.created_at as string)!,
      nickname: r.nickname as string,
      flag: r.flag as string,
      nameColor: (r.name_color as string) ?? null,
      nameEffect: (r.name_effect as string) ?? null,
      userStatus: r.user_status as "active" | "banned",
    };
    const loadout: Loadout = { shipTier: row.shipTier, items: items.get(row.userId) ?? {}, npcs: npcs.get(row.userId) ?? {} };
    const stats = statsOf(loadout);
    out.set(row.userId, {
      ...row,
      loadout,
      stats,
      hpNow: currentHp(row.hp, row.hpAt, stats, now),
      ...(records.get(row.userId) ?? { wins: 0, losses: 0 }),
    });
  }
  return out;
}

/** 지금 휘하인지 (기한이 지나면 자동으로 풀린 것으로 본다) */
export function activeOverlord(c: CrewRow, now = Date.now()): string | null {
  return c.overlordId && c.vassalUntil && c.vassalUntil.getTime() > now ? c.overlordId : null;
}

/** 보호 중인지: 창단·독립 직후, 휘하 기간이 끝난 직후 며칠 */
export function protectedUntil(c: CrewRow, now = Date.now()): Date | null {
  const candidates: number[] = [];
  if (c.protectedUntil && c.protectedUntil.getTime() > now) candidates.push(c.protectedUntil.getTime());
  if (c.vassalUntil && c.vassalUntil.getTime() <= now) {
    const after = c.vassalUntil.getTime() + NAVAL.freedProtectDays * 86400_000;
    if (after > now) candidates.push(after);
  }
  return candidates.length ? new Date(Math.max(...candidates)) : null;
}

/** 오늘(한국 날짜) 한 일반 공격·독립 전쟁 횟수 */
export async function raidsToday(exec: Exec, userId: string): Promise<{ raids: number; wars: number }> {
  const res = await exec.execute<{ raids: string | number; wars: string | number }>(sql`
    select count(*) filter (where independence = false) as raids, count(*) filter (where independence) as wars
    from battles
    where attacker_id = ${userId}
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
  `);
  return { raids: Number(res.rows[0]?.raids ?? 0), wars: Number(res.rows[0]?.wars ?? 0) };
}

/** 최근 며칠 안에 내가 공격한 상대 id */
export async function recentTargets(exec: Exec, userId: string): Promise<Set<string>> {
  const res = await exec.execute<{ defender_id: string }>(sql`
    select distinct defender_id from battles
    where attacker_id = ${userId} and independence = false
      and created_at > now() - make_interval(days => ${NAVAL.sameTargetDays})
  `);
  return new Set(res.rows.map((r) => r.defender_id));
}

export type AttackCheck = { ok: true; independence: boolean } | { ok: false; reason: string };

/** 공격할 수 있는지 (화면 표시와 서버 검사에 같이 쓴다) */
export function canAttack(
  me: CrewFull,
  target: CrewFull,
  ctx: { raidsToday: number; warsToday: number; recentTargets: Set<string> },
  now = Date.now(),
): AttackCheck {
  if (me.userId === target.userId) return { ok: false, reason: "우리 해적단" };
  if (target.userStatus !== "active") return { ok: false, reason: "해산됨" };
  const myLord = activeOverlord(me, now);
  const independence = myLord === target.userId;
  if (me.hpNow < (me.stats.maxHp * NAVAL.minAttackHpPct) / 100) return { ok: false, reason: "우리 배 수리 필요" };
  if (independence) {
    if (ctx.warsToday >= NAVAL.warsPerDay) return { ok: false, reason: "오늘 독립 전쟁 완료" };
    return { ok: true, independence: true };
  }
  if (myLord) return { ok: false, reason: "휘하라 독립 전쟁만 가능" };
  if (activeOverlord(target, now) === me.userId) return { ok: false, reason: "이미 우리 휘하" };
  if (activeOverlord(target, now)) return { ok: false, reason: "다른 해적단 휘하" };
  if (protectedUntil(target, now)) return { ok: false, reason: "보호 중" };
  if (ctx.recentTargets.has(target.userId)) return { ok: false, reason: `${NAVAL.sameTargetDays}일 안에 공격함` };
  if (ctx.raidsToday >= NAVAL.raidsPerDay) return { ok: false, reason: "오늘 공격 완료" };
  return { ok: true, independence: false };
}
