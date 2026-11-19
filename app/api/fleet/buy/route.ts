import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { crews } from "@/db/schema";
import { bad, handle, HttpError, readJson, requireUser } from "@/lib/auth";
import { spend } from "@/lib/doubloons";
import { fleetState } from "@/lib/fleetState";
import { ITEM_BUY_MAX, itemOf, npcOf, repairCost, SHIPS, statsOf } from "@/lib/naval";
import { loadCrews } from "@/lib/navalServer";

/**
 * 해적단 구매: 배 업그레이드(다음 단계만), 무기·방어구(개수), NPC 선원(레벨업), 수리.
 * 전부 spend() 트랜잭션 안에서 반영해, 금화만 빠지고 물건이 안 들어오는 일이 없게 한다.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const kind = body.kind;
  const crew = (await loadCrews(undefined, [user.id])).get(user.id);
  if (!crew) bad("해적단을 먼저 만들어 주세요.");
  let message = "";

  if (kind === "ship") {
    const next = SHIPS[crew.shipTier + 1];
    if (!next) bad("이미 가장 좋은 배예요.");
    const newMax = statsOf({ ...crew.loadout, shipTier: next.tier }).maxHp;
    const hp = Math.min(newMax, crew.hpNow + (newMax - crew.stats.maxHp));
    await spend(user.id, next.price, "naval_shop", `ship:${next.tier}`, async (tx) => {
      const done = await tx
        .update(crews)
        .set({ shipTier: next.tier, hp, hpAt: new Date() })
        .where(and(eq(crews.userId, user.id), eq(crews.shipTier, crew.shipTier)))
        .returning({ id: crews.userId });
      if (!done.length) throw new HttpError(409, "배가 이미 바뀌었어요. 다시 시도해 주세요.");
    });
    message = `⛵ ${next.name}(으)로 갈아탔어요!`;
  } else if (kind === "item") {
    const item = typeof body.id === "string" ? itemOf(body.id) : undefined;
    const qty = Number(body.qty ?? 1);
    if (!item) bad("없는 장비예요.");
    if (!Number.isInteger(qty) || qty < 1 || qty > ITEM_BUY_MAX) bad(`한 번에 1~${ITEM_BUY_MAX}개까지 살 수 있어요.`);
    await spend(user.id, item.price * qty, "naval_shop", `item:${item.id}:${qty}`, (tx) =>
      tx.execute(sql`
        insert into crew_items (user_id, item_id, qty) values (${user.id}, ${item.id}, ${qty})
        on conflict (user_id, item_id) do update set qty = crew_items.qty + excluded.qty
      `),
    );
    message = `${item.kind === "weapon" ? "⚔️" : "🛡"} ${item.name} ${qty}개를 실었어요`;
  } else if (kind === "npc") {
    const npc = typeof body.role === "string" ? npcOf(body.role) : undefined;
    if (!npc) bad("없는 선원이에요.");
    const lv = crew.loadout.npcs[npc.role] ?? 0;
    if (lv >= npc.maxLevel) bad("이미 최고 레벨이에요.");
    await spend(user.id, npc.prices[lv], "naval_shop", `npc:${npc.role}:${lv + 1}`, async (tx) => {
      const res = await tx.execute(sql`
        insert into crew_npcs (user_id, role, level) values (${user.id}, ${npc.role}, 1)
        on conflict (user_id, role) do update set level = crew_npcs.level + 1
        where crew_npcs.level = ${lv}
        returning level
      `);
      if (!res.rows.length) throw new HttpError(409, "이미 레벨이 올랐어요. 다시 시도해 주세요.");
    });
    message = lv === 0 ? `👥 ${crew.name} ${npc.name}이(가) 승선했어요!` : `👥 ${crew.name} ${npc.name} Lv.${lv + 1}!`;
  } else if (kind === "repair") {
    const cost = repairCost(crew.hpNow, crew.stats.maxHp);
    if (cost <= 0) bad("배가 이미 멀쩡해요.");
    await spend(user.id, cost, "naval_shop", "repair", (tx) =>
      tx.update(crews).set({ hp: crew.stats.maxHp, hpAt: new Date() }).where(eq(crews.userId, user.id)),
    );
    message = "🔧 배를 완전히 수리했어요";
  } else {
    bad("없는 상품이에요.");
  }

  return NextResponse.json({ message, state: await fleetState(user.id) });
});
