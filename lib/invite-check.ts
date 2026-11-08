import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { maxMembers } from "./constants";

export type InviteCheck =
  | { ok: true; referrer: string }
  | { ok: false; reason: "missing" | "not_found" | "used" | "expired" | "revoked" | "full"; message: string };

export const INVITE_MESSAGES = {
  missing: "승선권 코드가 필요해요. 추천해 준 선원에게 코드를 받아 주세요.",
  not_found: "존재하지 않는 승선권이에요. 코드를 다시 확인해 주세요.",
  used: "이미 사용된 승선권이에요. 새 승선권을 요청해 주세요.",
  expired: "기한이 지난 승선권이에요(발급 후 7일). 새 승선권을 요청해 주세요.",
  revoked: "더 이상 쓸 수 없는 승선권이에요.",
  full: "배가 꽉 찼어요. 지금은 정원이 다 차서 새 선원을 받을 수 없어요.",
} as const;

type Executor = Pick<typeof db, "select">;

export async function countActiveMembers(tx: Executor = db): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(users).where(eq(users.status, "active"));
  return row?.n ?? 0;
}

/** 승선권 상태 확인. forUpdate=true면 트랜잭션 안에서 행 잠금 */
export async function checkInvite(code: string, tx: Executor = db): Promise<InviteCheck> {
  if (!code) return { ok: false, reason: "missing", message: INVITE_MESSAGES.missing };
  const [row] = await tx
    .select({
      usedBy: invites.usedBy,
      expiresAt: invites.expiresAt,
      referrer: users.nickname,
      referrerStatus: users.status,
    })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.createdBy))
    .where(eq(invites.code, code))
    .limit(1);

  const fail = (reason: Exclude<InviteCheck, { ok: true }>["reason"]): InviteCheck => ({
    ok: false,
    reason,
    message: INVITE_MESSAGES[reason],
  });

  if (!row) return fail("not_found");
  if (row.usedBy) return fail("used");
  if (row.referrerStatus !== "active") return fail("revoked");
  if (row.expiresAt.getTime() < Date.now()) return fail("expired");
  if ((await countActiveMembers(tx)) >= maxMembers()) return fail("full");
  return { ok: true, referrer: row.referrer };
}
