import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { bad, handle, readJson, setSessionCookie } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!nickname || !password) bad("닉네임과 비밀번호를 입력해 주세요.");

  const [user] = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) bad("닉네임 또는 비밀번호가 맞지 않아요.", 401);
  if (user.status !== "active") bad("추방된 선원은 승선할 수 없어요.", 403);

  await setSessionCookie(user);
  return NextResponse.json({ ok: true });
});
