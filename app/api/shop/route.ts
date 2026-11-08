import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@/db/schema";
import { bad, handle, readJson, requireUser } from "@/lib/auth";
import { spend } from "@/lib/doubloons";
import { FLAGS, NAME_COLORS, SHOP_PRICE } from "@/lib/game";

/** 선상 상점: 깃발, 닉네임 색 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const item = body.item;
  const value = typeof body.value === "string" ? body.value : "";

  if (item === "flag") {
    if (!(FLAGS as readonly string[]).includes(value)) bad("없는 깃발이에요.");
    if (user.flag === value) bad("이미 쓰고 있는 깃발이에요.");
    await spend(user.id, SHOP_PRICE.flag, "shop", `flag:${value}`, (tx) =>
      tx.update(users).set({ flag: value }).where(eq(users.id, user.id)),
    );
  } else if (item === "color") {
    if (!NAME_COLORS.some((c) => c.id === value)) bad("없는 색이에요.");
    if (user.nameColor === value) bad("이미 쓰고 있는 색이에요.");
    await spend(user.id, SHOP_PRICE.color, "shop", `color:${value}`, (tx) =>
      tx.update(users).set({ nameColor: value }).where(eq(users.id, user.id)),
    );
  } else {
    bad("없는 상품이에요.");
  }
  return NextResponse.json({ ok: true });
});
