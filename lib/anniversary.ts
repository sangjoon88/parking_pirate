import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { doubloonLogs, type User } from "@/db/schema";
import { ANNIVERSARIES } from "./game";

/**
 * 승선 기념일이 지났으면 보상 지급. 이번에 새로 받은 기념일 목록을 돌려준다.
 * 선원별 잠금 안에서 확인·지급해서, 내 정보 화면을 동시에 여러 번 열어도 한 번만 받는다.
 */
export async function grantAnniversaries(user: Pick<User, "id" | "createdAt">) {
  const days = Math.floor((Date.now() - user.createdAt.getTime()) / 86400_000);
  const due = ANNIVERSARIES.filter((a) => days >= a.days);
  if (!due.length) return [];
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"anniversary:" + user.id}))`);
    const granted: { label: string; reward: number }[] = [];
    for (const a of due) {
      const ref = `day${a.days}`;
      const [had] = await tx
        .select({ id: doubloonLogs.id })
        .from(doubloonLogs)
        .where(and(eq(doubloonLogs.userId, user.id), eq(doubloonLogs.reason, "anniversary"), eq(doubloonLogs.refId, ref)))
        .limit(1);
      if (had) continue;
      await tx.insert(doubloonLogs).values({ userId: user.id, amount: a.reward, reason: "anniversary", refId: ref });
      granted.push({ label: a.label, reward: a.reward });
    }
    return granted;
  });
}
