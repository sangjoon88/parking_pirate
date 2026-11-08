import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { SESSION_COOKIE, SESSION_DAYS } from "./constants";
import { signSession, verifySession } from "./session";

export async function setSessionCookie(user: Pick<User, "id" | "nickname" | "role">) {
  const token = await signSession({ sub: user.id, nickname: user.nickname, role: user.role });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** 세션 + DB 상태까지 확인한 현재 선원. 추방됐거나 없으면 null */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  if (!user || user.status !== "active") return null;
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "다시 로그인해 주세요.");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "관리자만 할 수 있어요.");
  return user;
}

/** route handler 공통 에러 처리 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ error: "서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
  };
}

export function bad(message: string, status = 400): never {
  throw new HttpError(status, message);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
