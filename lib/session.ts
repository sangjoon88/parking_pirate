import { jwtVerify, SignJWT } from "jose";
import { SESSION_DAYS } from "./constants";

export type SessionPayload = { sub: string; nickname: string; role: "admin" | "member" };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET 환경 변수가 없거나 너무 짧습니다.");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ nickname: p.nickname, role: p.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      nickname: String(payload.nickname ?? ""),
      role: payload.role === "admin" ? "admin" : "member",
    };
  } catch {
    return null;
  }
}
