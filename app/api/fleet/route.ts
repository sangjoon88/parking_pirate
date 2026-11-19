import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { crews } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { fleetState } from "@/lib/fleetState";
import { NAVAL, shipOf, validCrewName } from "@/lib/naval";

/** 해적단 화면 상태 */
export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json(await fleetState(user.id));
});

/** 해적단 창단 (선원 한 명당 하나, 무료 돛단배로 시작) */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const err = validCrewName(name);
  if (err) bad(err);

  const res = await db.execute<{ user_id: string }>(sql`
    insert into crews (user_id, name, ship_tier, hp, protected_until)
    values (${user.id}, ${name}, 0, ${shipOf(0).hp}, now() + make_interval(days => ${NAVAL.newCrewProtectDays}))
    on conflict do nothing
    returning user_id
  `);
  if (!res.rows.length) {
    const [mine] = await db.select({ id: crews.userId }).from(crews).where(sql`${crews.userId} = ${user.id}`).limit(1);
    bad(mine ? "이미 해적단이 있어요." : "같은 이름의 해적단이 있어요.");
  }
  return NextResponse.json(await fleetState(user.id), { status: 201 });
});
