import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { doubloonLogs, users } from "@/db/schema";
import { HttpError } from "./errors";
import { lineageShare } from "./game";

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

/** 금화 지급. 양수 지급이면 추천인에게 10%가 따라간다. */
export async function award(userId: string, amount: number, reason: Reason, refId?: string | null) {
  if (!amount) return;
  await db.insert(doubloonLogs).values({ userId, amount, reason, refId: refId ?? null });
  if (amount > 0 && reason !== "lineage" && reason !== "lineage_ban") {
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
}

/** 최근 hours 시간 안에 같은 사유(+같은 대상)로 받은 적이 있는지 */
export async function awardedRecently(userId: string, reason: Reason, hours: number, refId?: string) {
  const since = new Date(Date.now() - hours * 3600_000);
  const [row] = await db
    .select({ id: doubloonLogs.id })
    .from(doubloonLogs)
    .where(
      and(
        eq(doubloonLogs.userId, userId),
        eq(doubloonLogs.reason, reason),
        gt(doubloonLogs.createdAt, since),
        refId ? eq(doubloonLogs.refId, refId) : undefined,
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * "번 금화"로 치는 기록: 양수이면서 환불이 아닌 것.
 * 상점·현상금·보물에 쓴 금화 때문에 랭킹이 떨어지지 않도록 지출은 빼고 센다.
 */
export const EARNING = sql.raw(`(l.amount > 0 and l.reason <> 'duel_refund')`);

/** 이달의 해적왕: 이번 달 번 금화 1위 (활동 선원, 1개 이상) */
export async function currentKingId(): Promise<string | null> {
  const res = await db.execute<{ user_id: string }>(sql`
    select l.user_id
    from doubloon_logs l join users u on u.id = l.user_id
    where l.created_at >= ${MONTH_START_KST} and u.status = 'active' and ${EARNING}
    group by l.user_id
    order by sum(l.amount) desc, min(l.created_at) asc
    limit 1
  `);
  return res.rows[0]?.user_id ?? null;
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
