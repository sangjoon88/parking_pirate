import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/auth";
import { getActiveParking } from "@/lib/parking";

export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json({ parking: await getActiveParking(user.id) });
});
