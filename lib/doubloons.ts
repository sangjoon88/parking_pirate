import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { doubloonLogs, users } from "@/db/schema";
import { HttpError } from "./errors";
import { lineageShare } from "./game";
import { NAVAL } from "./naval";

type Reason = (typeof doubloonLogs.$inferInsert)["reason"];
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function balanceOf(userId: string): Promise<number> {
  const res = await db.execute<{ b: string | number }>(
    sql`select coalesce(sum(amount), 0) as b from doubloon_logs where user_id = ${userId}`,
  );
  return Number(res.rows[0]?.b ?? 0);
}

/**
 * 금화 사용. 잔액이 모자라면 HttpError(400).
 * 선원별 잠금을 걸어, 동시에 두 번 써서 잔액이 음수가 되는 일을 막는다.
 * then은 같은 트랜잭션 안에서 실행된다 (구매 결과 반영용).
 */
export async function spend<T>(
  userId: string,
  amount: number,
  reason: Reason,
  refId: string | null,
  then: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"spend:" + userId}))`);
    const res = await tx.execute<{ b: string | number }>(
      sql`select coalesce(sum(amount), 0) as b from doubloon_logs where user_id = ${userId}`,
    );
    const balance = Number(res.rows[0]?.b ?? 0);
    if (balance < amount) throw new HttpError(400, `두블룬이 모자라요. (보유 ${balance}, 필요 ${amount})`);
    await tx.insert(doubloonLogs).values({ userId, amount: -amount, reason, refId });
    return then(tx);
  });
}

/** 이번 달 시작 시각 (한국 시간 기준) */
export const MONTH_START_KST = sql`(date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`;

/**
 * 선원끼리 오간 금화와 환불: 새로 번 금화가 아니다.
 * 추천인 몫·상납을 붙이지 않고, 랭킹·해적왕("번 금화")에서도 뺀다.
 * (짜고 주고받거나 내가 건 현상금을 내가 가져가서 금화·랭킹을 불리는 것 방지)
 */
export const NOT_EARNED_REASONS = [
  "duel_refund",
  "duel_win", // 판돈은 선원끼리 오간 돈
  "independence",
  "stash_found", // 다른 선원이 묻은 금화
  "stash_refund",
  "bounty_posted", // 선원이 건 현상금
  "bounty_refund",
] as const satisfies readonly Reason[];
const NOT_EARNED = new Set<Reason>(NOT_EARNED_REASONS);

/** 이미 준 보상을 되돌리는 기록(음수). "번 금화"에서도 빼야 등록·삭제 반복으로 랭킹이 오르지 않는다 */
export const CLAWBACK_REASONS = ["spot_deleted", "tribute_revoked"] as const satisfies readonly Reason[];

/** 휘하 해적단이 상납하는 수입 (활동으로 번 금화만) */
const TRIBUTE_REASONS = new Set<Reason>([
  "discovery",
  "new_cell",
  "report",
  "parking",
  "bounty",
  "fleet",
  "toll",
  "treasure",
  "wonder_solved",
]);

/**
 * 상납: 해전에서 져서 휘하에 있는 동안, 번 금화의 상납률만큼 주인 해적단에게 넘어간다.
 * 휘하 1회당 상한이 있고, 주인이 추방됐으면 내지 않는다.
 */
async function payTribute(userId: string, amount: number) {
  const res = await db.execute<{ overlord_id: string; battle_id: string; rate: number; paid: string | number }>(sql`
    select c.overlord_id, c.vassal_battle_id as battle_id, c.tribute_rate as rate,
      coalesce((select -sum(l.amount) from doubloon_logs l
        where l.user_id = c.user_id and l.reason = 'tribute_paid' and l.ref_id = c.vassal_battle_id::text), 0) as paid
    from crews c join users o on o.id = c.overlord_id and o.status = 'active'
    where c.user_id = ${userId} and c.vassal_until > now() and c.vassal_battle_id is not null
  `);
  const v = res.rows[0];
  if (!v) return;
  const t = Math.min(Math.floor((amount * Number(v.rate)) / 100), NAVAL.tributeCap - Number(v.paid));
  if (t <= 0) return;
  await db.insert(doubloonLogs).values([
    { userId, amount: -t, reason: "tribute_paid", refId: v.battle_id },
    { userId: v.overlord_id, amount: t, reason: "tribute", refId: v.battle_id },
  ]);
}

/** 새로 번 금화에 따라붙는 것: 휘하면 상납, 추천인에게 10% */
async function afterEarned(userId: string, amount: number, reason: Reason) {
  if (amount <= 0 || NOT_EARNED.has(reason) || reason === "lineage" || reason === "lineage_ban") return;
  if (TRIBUTE_REASONS.has(reason)) await payTribute(userId, amount);
  const [me] = await db
    .select({ referrerId: users.referrerId, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (me?.referrerId) {
    const [ref] = await db.select({ status: users.status }).from(users).where(eq(users.id, me.referrerId)).limit(1);
    if (ref?.status === "active") {
      await db
        .insert(doubloonLogs)
        .values({ userId: me.referrerId, amount: lineageShare(amount), reason: "lineage", refId: userId });
    }
  }
}

/** 금화 지급. 새로 번 금화면 추천인에게 10%가 따라가고, 휘하 해적단이면 상납한다. */
export async function award(userId: string, amount: number, reason: Reason, refId?: string | null) {
  if (!amount) return;
  await db.insert(doubloonLogs).values({ userId, amount, reason, refId: refId ?? null });
  await afterEarned(userId, amount, reason);
}

/** 트랜잭션 안에서 장부에 먼저 기록한 금화의 후속 처리(상납·추천인 몫). 커밋한 뒤에 부른다 */
export const settleEarned = afterEarned;

/**
 * 쿨다운이 있는 보상: 최근 hours 시간 안에 같은 사유·같은 대상으로 받은 적이 없을 때만 지급.
 * 확인과 기록을 잠금 안에서 해서, 동시에 여러 번 요청해도 한 번만 받는다. 지급했으면 true
 */
export async function awardOnce(userId: string, amount: number, reason: Reason, refId: string, hours: number) {
  if (!amount) return false;
  const given = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`award:${userId}:${reason}:${refId}`}))`);
    const [row] = await tx
      .select({ id: doubloonLogs.id })
      .from(doubloonLogs)
      .where(
        and(
          eq(doubloonLogs.userId, userId),
          eq(doubloonLogs.reason, reason),
          eq(doubloonLogs.refId, refId),
          gt(doubloonLogs.createdAt, new Date(Date.now() - hours * 3600_000)),
        ),
      )
      .limit(1);
    if (row) return false;
    await tx.insert(doubloonLogs).values({ userId, amount, reason, refId });
    return true;
  });
  if (given) await afterEarned(userId, amount, reason);
  return given;
}

/**
 * "번 금화"로 치는 기록: 양수이면서 선원끼리 오간 돈·환불이 아닌 것 + 보상 회수(음수).
 * 상점·현상금·보물에 쓴 금화 때문에 랭킹이 떨어지지 않도록 지출은 빼고 센다.
 */
const list = (xs: readonly string[]) => xs.map((x) => `'${x}'`).join(", ");
export const EARNING = sql.raw(
  `((l.amount > 0 and l.reason not in (${list(NOT_EARNED_REASONS)})) or l.reason in (${list(CLAWBACK_REASONS)}))`,
);

/** 이달의 해적왕: 이번 달 번 금화 1위 (활동 선원, 1개 이상) */
export async function currentKingId(): Promise<string | null> {
  const res = await db.execute<{ user_id: string }>(sql`
    select l.user_id
    from doubloon_logs l join users u on u.id = l.user_id
    where l.created_at >= ${MONTH_START_KST} and u.status = 'active' and ${EARNING}
    group by l.user_id
    having sum(l.amount) > 0
    order by sum(l.amount) desc, min(l.created_at) asc
    limit 1
  `);
  return res.rows[0]?.user_id ?? null;
}

/** 지난달 시작 시각 (한국 시간 기준) */
const LAST_MONTH_START_KST = sql`(date_trunc('month', (now() at time zone 'Asia/Seoul') - interval '1 month') at time zone 'Asia/Seoul')`;

/**
 * 지난달 해적왕: 지난달 번 금화 1위. 이번 달 내내 그가 영주인 정박지에 👑 표시.
 * 이번 달 해적왕과 같은 규칙(활동 선원, 번 금화만)이다.
 */
export async function lastMonthKing(): Promise<{ userId: string; nickname: string } | null> {
  const res = await db.execute<{ user_id: string; nickname: string }>(sql`
    select l.user_id, u.nickname
    from doubloon_logs l join users u on u.id = l.user_id
    where l.created_at >= ${LAST_MONTH_START_KST} and l.created_at < ${MONTH_START_KST}
      and u.status = 'active' and ${EARNING}
    group by l.user_id, u.nickname
    having sum(l.amount) > 0
    order by sum(l.amount) desc, min(l.created_at) asc
    limit 1
  `);
  const r = res.rows[0];
  return r ? { userId: r.user_id, nickname: r.nickname } : null;
}

export type CrewStats = { userId: string; total: number; month: number; discoveries: number };

/** 선원별 금화 합계·이번 달 금화·발견 수 */
export async function crewStats(): Promise<Map<string, CrewStats>> {
  const res = await db.execute<{ id: string; total: string | number; month: string | number; discoveries: string | number }>(sql`
    select u.id,
      coalesce((select sum(amount) from doubloon_logs l where l.user_id = u.id), 0) as total,
      coalesce((select sum(amount) from doubloon_logs l
        where l.user_id = u.id and l.created_at >= ${MONTH_START_KST} and ${EARNING}), 0) as month,
      (select count(*) from spots s where s.created_by = u.id) as discoveries
    from users u
  `);
  return new Map(
    res.rows.map((r) => [
      r.id,
      { userId: r.id, total: Number(r.total), month: Number(r.month), discoveries: Number(r.discoveries) },
    ]),
  );
}
