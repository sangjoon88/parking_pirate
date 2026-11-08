import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { parkings } from "@/db/schema";
import { handle, requireUser } from "@/lib/auth";
import { closeStaleParkings } from "@/lib/parking";

/** 출항(정박 종료) */
export const POST = handle(async () => {
  const user = await requireUser();
  await closeStaleParkings(user.id);
  await db
    .update(parkings)
    .set({ endedAt: new Date() })
    .where(and(eq(parkings.userId, user.id), isNull(parkings.endedAt)));
  return NextResponse.json({ ok: true });
});
