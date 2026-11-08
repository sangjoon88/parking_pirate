import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { doubloonLogs, parkings, spots } from "@/db/schema";
import { handle, requireUser } from "@/lib/auth";
import { badgesFor } from "@/lib/badges";
import { crewStats, currentKingId } from "@/lib/doubloons";
import { nextTitle, titleFor } from "@/lib/game";
import { closeStaleParkings } from "@/lib/parking";

export const GET = handle(async () => {
  const user = await requireUser();
  await closeStaleParkings(user.id);

  const [history, logs, stats, kingId, badges] = await Promise.all([
    db
      .select({
        id: parkings.id,
        spotName: spots.name,
        startedAt: parkings.startedAt,
        endedAt: parkings.endedAt,
      })
      .from(parkings)
      .innerJoin(spots, eq(spots.id, parkings.spotId))
      .where(eq(parkings.userId, user.id))
      .orderBy(desc(parkings.startedAt))
      .limit(20),
    db
      .select({ id: doubloonLogs.id, amount: doubloonLogs.amount, reason: doubloonLogs.reason, createdAt: doubloonLogs.createdAt })
      .from(doubloonLogs)
      .where(eq(doubloonLogs.userId, user.id))
      .orderBy(desc(doubloonLogs.createdAt))
      .limit(15),
    crewStats(),
    currentKingId(),
    badgesFor(user.id),
  ]);

  const mine = stats.get(user.id) ?? { total: 0, month: 0, discoveries: 0 };
  return NextResponse.json({
    user: { id: user.id, nickname: user.nickname, role: user.role, createdAt: user.createdAt },
    doubloons: { total: mine.total, month: mine.month, logs },
    title: titleFor(mine.discoveries),
    nextTitle: nextTitle(mine.discoveries),
    discoveries: mine.discoveries,
    isKing: kingId === user.id,
    badges,
    history,
  });
});
