import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { duels, users } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { spend } from "@/lib/doubloons";
import { duelsOf } from "@/lib/duels";
import { DUEL_STAKES } from "@/lib/game";

const UUID = /^[0-9a-f-]{36}$/i;

export const GET = handle(async () => {
  const user = await requireUser();
  const list = await duelsOf(user.id);
  const ids = [...new Set(list.flatMap((d) => [d.challengerId, d.opponentId]))];
  const names = ids.length
    ? await db.select({ id: users.id, nickname: users.nickname }).from(users).where(inArray(users.id, ids))
    : [];
  const nick = new Map(names.map((n) => [n.id, n.nickname]));
  return NextResponse.json({
    duels: list.map((d) => ({
      ...d,
      challenger: nick.get(d.challengerId) ?? "?",
      opponent: nick.get(d.opponentId) ?? "?",
      mine: d.challengerId === user.id ? "challenger" : "opponent",
    })),
  });
});

/** 결투 신청: 판돈은 신청할 때 걸고, 상대가 받으면 상대도 건다 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const opponentId = typeof body.opponentId === "string" ? body.opponentId : "";
  const stake = Number(body.stake);
  if (!(DUEL_STAKES as readonly number[]).includes(stake)) bad("판돈을 골라 주세요.");
  if (!UUID.test(opponentId) || opponentId === user.id) bad("결투 상대를 다시 골라 주세요.");

  const [opp] = await db.select().from(users).where(eq(users.id, opponentId)).limit(1);
  if (!opp || opp.status !== "active") bad("결투할 수 없는 선원이에요.");

  // 두 사람 사이에 진행 중이거나 대기 중인 결투가 있으면 막는다
  const [open] = await db
    .select({ id: duels.id })
    .from(duels)
    .where(
      and(
        inArray(duels.status, ["pending", "active"]),
        or(
          and(eq(duels.challengerId, user.id), eq(duels.opponentId, opponentId)),
          and(eq(duels.challengerId, opponentId), eq(duels.opponentId, user.id)),
        ),
      ),
    )
    .limit(1);
  if (open) bad(`${opp.nickname}님과는 이미 결투가 걸려 있어요.`);

  await spend(user.id, stake, "duel_stake", null, (tx) =>
    tx.insert(duels).values({ challengerId: user.id, opponentId, stake }),
  );
  return NextResponse.json({ ok: true }, { status: 201 });
});
