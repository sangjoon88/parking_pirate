import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { doubloonLogs, type User } from "@/db/schema";
import { ANNIVERSARIES } from "./game";

/** 승선 기념일이 지났으면 보상 지급. 이번에 새로 받은 기념일 목록을 돌려준다 */
export async function grantAnniversaries(user: Pick<User, "id" | "createdAt">) {
  const days = Math.floor((Date.now() - user.createdAt.getTime()) / 86400_000);
  const granted: { label: string; reward: number }[] = [];
  for (const a of ANNIVERSARIES) {
    if (days < a.days) continue;
    const ref = `day${a.days}`;
    const [had] = await db
      .select({ id: doubloonLogs.id })
      .from(doubloonLogs)
      .where(and(eq(doubloonLogs.userId, user.id), eq(doubloonLogs.reason, "anniversary"), eq(doubloonLogs.refId, ref)))
      .limit(1);
    if (had) continue;
    await db.insert(doubloonLogs).values({ userId: user.id, amount: a.reward, reason: "anniversary", refId: ref });
    granted.push({ label: a.label, reward: a.reward });
  }
  return granted;
}
