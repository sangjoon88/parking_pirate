import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { balanceOf } from "./doubloons";
import type { BattleLog, BattleView, CrewView, FleetState, RivalView } from "./fleetTypes";
import { crewTitle, NAVAL } from "./naval";
import { activeOverlord, canAttack, loadCrews, protectedUntil, raidsToday, recentTargets, type CrewFull } from "./navalServer";

const iso = (v: Date | null) => (v ? v.toISOString() : null);

/** 해적단 화면 전체 상태 */
export async function fleetState(userId: string): Promise<FleetState> {
  const [crews, balance, raids, targets, battleRes, paidRes] = await Promise.all([
    loadCrews(),
    balanceOf(userId),
    raidsToday(db, userId),
    recentTargets(db, userId),
    db.execute<{ id: string; created_at: Date | string; log: BattleLog }>(sql`
      select id, created_at, log from battles
      where attacker_id = ${userId} or defender_id = ${userId}
      order by created_at desc limit 15
    `),
    db.execute<{ paid: string | number }>(sql`
      select coalesce(-sum(l.amount), 0) as paid from doubloon_logs l join crews c on c.user_id = l.user_id
      where l.user_id = ${userId} and l.reason = 'tribute_paid' and l.ref_id = c.vassal_battle_id::text
    `),
  ]);
  const now = Date.now();
  const mine = crews.get(userId) ?? null;

  let crew: CrewView | null = null;
  if (mine) {
    const lordId = activeOverlord(mine, now);
    const lord = lordId ? crews.get(lordId) : undefined;
    crew = {
      userId: mine.userId,
      name: mine.name,
      nickname: mine.nickname,
      flag: mine.flag,
      nameColor: mine.nameColor,
      nameEffect: mine.nameEffect,
      shipTier: mine.shipTier,
      hp: mine.hpNow,
      stats: mine.stats,
      loadout: mine.loadout,
      wins: mine.wins,
      losses: mine.losses,
      title: crewTitle(mine.wins),
      overlord:
        lord && mine.vassalUntil
          ? { userId: lord.userId, name: lord.name, until: mine.vassalUntil.toISOString(), rate: mine.tributeRate, paid: Number(paidRes.rows[0]?.paid ?? 0) }
          : null,
      vassals: [...crews.values()]
        .filter((c) => activeOverlord(c, now) === userId)
        .map((c) => ({ userId: c.userId, name: c.name, until: c.vassalUntil!.toISOString() })),
      protectedUntil: iso(protectedUntil(mine, now)),
    };
  }

  const rivals: RivalView[] = [...crews.values()]
    .filter((c) => c.userId !== userId && c.userStatus === "active")
    .map((c: CrewFull) => {
      const lordId = activeOverlord(c, now);
      const check = mine ? canAttack(mine, c, { raidsToday: raids, recentTargets: targets }, now) : { ok: false as const, reason: "해적단 창단 필요" };
      return {
        userId: c.userId,
        name: c.name,
        nickname: c.nickname,
        flag: c.flag,
        nameColor: c.nameColor,
        nameEffect: c.nameEffect,
        shipTier: c.shipTier,
        power: c.stats.power,
        hpPct: Math.round((c.hpNow / c.stats.maxHp) * 100),
        wins: c.wins,
        losses: c.losses,
        title: crewTitle(c.wins),
        overlordName: lordId ? (crews.get(lordId)?.name ?? null) : null,
        protectedUntil: iso(protectedUntil(c, now)),
        attack: check.ok ? { ok: true, independence: check.independence, reason: "" } : { ok: false, independence: false, reason: check.reason },
      };
    })
    .sort((a, b) => Number(b.attack.ok) - Number(a.attack.ok) || b.power - a.power);

  const battles: BattleView[] = battleRes.rows.map((b) => ({ id: b.id, createdAt: new Date(b.created_at).toISOString(), log: b.log }));
  return { me: { id: userId, balance }, crew, rivals, battles, raidsLeft: Math.max(0, NAVAL.raidsPerDay - raids) };
}
