import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handle, requireUser } from "@/lib/auth";

export const GET = handle(async () => {
  const me = await requireUser();
  const crew = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      referrerId: users.referrerId,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
  return NextResponse.json({ me: { id: me.id, role: me.role }, crew });
});
