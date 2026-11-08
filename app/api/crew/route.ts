import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handle, requireUser } from "@/lib/auth";
import { crewStats, currentKingId } from "@/lib/doubloons";
import { titleFor } from "@/lib/game";

export const GET = handle(async () => {
  const me = await requireUser();
  const [rows, stats, kingId] = await Promise.all([
    db
      .select({
        id: users.id,
        nickname: users.nickname,
        referrerId: users.referrerId,
        role: users.role,
        status: users.status,
        flag: users.flag,
        nameColor: users.nameColor,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),
    crewStats(),
    currentKingId(),
  ]);

  const crew = rows.map((u) => {
    const s = stats.get(u.id);
    return {
      ...u,
      title: titleFor(s?.discoveries ?? 0),
      doubloons: s?.total ?? 0,
      isKing: u.id === kingId,
    };
  });
  return NextResponse.json({ me: { id: me.id, role: me.role }, crew });
});
