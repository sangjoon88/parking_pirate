import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { battles, crews, doubloonLogs } from "@/db/schema";
import { bad, handle, HttpError, readJson, requireUser } from "@/lib/auth";
import { award } from "@/lib/doubloons";
import { fleetState } from "@/lib/fleetState";
import type { BattleLog } from "@/lib/fleetTypes";
import { itemOf, NAVAL, raidTerms, simulate, type CrewStats } from "@/lib/naval";
import { canAttack, loadCrews, raidsToday, recentTargets, type CrewFull } from "@/lib/navalServer";

const UUID = /^[0-9a-f-]{36}$/i;

/** 장착한 장비가 전투 후 확률적으로 부서진다 */
function rollBreaks(stats: CrewStats, won: boolean) {
  const pct = Math.max(NAVAL.breakMin, (won ? NAVAL.breakWinner : NAVAL.breakLoser) - stats.breakReduce);
  const out: { id: string; count: number }[] = [];
  for (const e of stats.equipped) {
    let n = 0;
    for (let i = 0; i < e.count; i++) if (Math.random() * 100 < pct) n++;
    if (n) out.push({ id: e.id, count: n });
  }
  return out;
}

/** 장착 장비 중 가장 강한 무기·방어구 (장착 목록은 강한 순) */
function gearOf(stats: CrewStats) {
  const find = (kind: "weapon" | "armor") => stats.equipped.find((e) => itemOf(e.id)?.kind === kind)?.id ?? null;
  return { weapon: find("weapon"), armor: find("armor") };
}

const side = (c: CrewFull) => ({
  userId: c.userId,
  name: c.name,
  flag: c.flag,
  shipTier: c.shipTier,
  maxHp: c.stats.maxHp,
  hp0: c.hpNow,
  power: c.stats.power,
});

/**
 * 해전: 자동 포격전.
 * - 일반 공격에서 이기면 상대가 1주일 휘하(상납), 지면 상대가 방어 보상
 * - 휘하가 주인에게 거는 독립 전쟁에서 이기면 바로 독립 + 낸 상납금 회수 + 보호 기간
 * 두 해적단을 잠그고 한 트랜잭션에서 검사·전투·결과 반영을 한다 (동시에 두 번 공격 방지).
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  if (!UUID.test(targetId)) bad("상대 해적단을 찾을 수 없어요.", 404);

  const result = await db.transaction(async (tx) => {
    for (const id of [user.id, targetId].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"crew:" + id}))`);
    }
    const [loaded, raids, targets] = await Promise.all([
      loadCrews(tx, [user.id, targetId]),
      raidsToday(tx, user.id),
      recentTargets(tx, user.id),
    ]);
    const me = loaded.get(user.id);
    const foe = loaded.get(targetId);
    if (!me) throw new HttpError(400, "해적단을 먼저 만들어 주세요.");
    if (!foe) throw new HttpError(404, "상대 해적단을 찾을 수 없어요.");
    const check = canAttack(me, foe, { raidsToday: raids, recentTargets: targets });
    if (!check.ok) throw new HttpError(400, `공격할 수 없어요: ${check.reason}`);
    const independence = check.independence;

    const sim = simulate(me.stats, foe.stats, me.hpNow, foe.hpNow);
    const terms = raidTerms(me.stats.power, foe.stats.power);
    const brokenA = rollBreaks(me.stats, sim.attackerWon);
    const brokenD = rollBreaks(foe.stats, !sim.attackerWon);
    const now = new Date();
    const battleId = randomUUID();

    // 독립 성공 시 돌려받을 상납금 (주인을 지우기 전에 계산)
    let refund = 0;
    if (independence && sim.attackerWon && me.vassalBattleId) {
      const r = await tx.execute<{ paid: string | number }>(sql`
        select coalesce(-sum(amount), 0) as paid from doubloon_logs
        where user_id = ${me.userId} and reason = 'tribute_paid' and ref_id = ${me.vassalBattleId}
      `);
      refund = Number(r.rows[0]?.paid ?? 0);
    }

    const log: BattleLog = {
      a: side(me),
      d: side(foe),
      shots: sim.shots,
      attackerWon: sim.attackerWon,
      independence,
      terms: terms.kind,
      tributeRate: !independence && sim.attackerWon ? terms.tributeRate : 0,
      loot: !independence && sim.attackerWon ? terms.loot : 0,
      defense: !independence && !sim.attackerWon ? terms.defense : 0,
      refund,
      brokenA,
      brokenD,
      gear: { a: gearOf(me.stats), d: gearOf(foe.stats) },
    };
    await tx.insert(battles).values({
      id: battleId,
      attackerId: me.userId,
      defenderId: foe.userId,
      winnerId: sim.attackerWon ? me.userId : foe.userId,
      independence,
      log,
      createdAt: now,
    });

    // 장비 파손
    for (const [uid, broken] of [
      [me.userId, brokenA],
      [foe.userId, brokenD],
    ] as const) {
      for (const b of broken) {
        await tx.execute(sql`
          update crew_items set qty = greatest(0, qty - ${b.count}) where user_id = ${uid} and item_id = ${b.id}
        `);
      }
    }

    // 체력 반영 + 결과
    if (independence) {
      await tx
        .update(crews)
        .set({
          hp: sim.hpA,
          hpAt: now,
          ...(sim.attackerWon
            ? {
                overlordId: null,
                vassalUntil: null,
                vassalBattleId: null,
                tributeRate: 0,
                protectedUntil: new Date(now.getTime() + NAVAL.freedProtectDays * 86400_000),
              }
            : {}),
        })
        .where(eq(crews.userId, me.userId));
      await tx.update(crews).set({ hp: sim.hpD, hpAt: now }).where(eq(crews.userId, foe.userId));
    } else {
      // 먼저 공격하면 내 보호 기간은 사라진다
      await tx.update(crews).set({ hp: sim.hpA, hpAt: now, protectedUntil: null }).where(eq(crews.userId, me.userId));
      await tx
        .update(crews)
        .set({
          hp: sim.hpD,
          hpAt: now,
          ...(sim.attackerWon
            ? {
                overlordId: me.userId,
                vassalUntil: new Date(now.getTime() + NAVAL.vassalDays * 86400_000),
                vassalBattleId: battleId,
                tributeRate: terms.tributeRate,
                protectedUntil: null,
              }
            : {}),
        })
        .where(eq(crews.userId, foe.userId));
    }
    return { battleId, log };
  });

  const { log, battleId } = result;
  if (log.loot) await award(user.id, log.loot, "naval_loot", battleId);
  if (log.defense) await award(targetId, log.defense, "naval_defense", battleId);
  // 회수한 상납금은 새로 번 돈이 아니므로 추천인 몫·상납 없이 바로 기록
  if (log.refund) await db.insert(doubloonLogs).values({ userId: user.id, amount: log.refund, reason: "independence", refId: battleId });

  return NextResponse.json({ battle: { id: battleId, createdAt: new Date().toISOString(), log }, state: await fleetState(user.id) });
});
