import { NextResponse } from "next/server";
import { clearSessionCookie, handle } from "@/lib/auth";

export const POST = handle(async () => {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
