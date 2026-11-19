/**
 * 해적단 해전 규칙 (서버·클라이언트 공용). 숫자는 전부 여기서 조정한다.
 *
 * 흐름: 정박·일지로 금화를 벌고 → 배·무기·방어구·NPC 선원을 사고 → 다른 해적단과 자동 포격전.
 * 이기면 진 해적단이 1주일간 휘하로 들어와 버는 금화 일부를 상납한다.
 * 일방적으로 흐르지 않게: 장비 소모, 약자 공격 시 낮은 상납률, 독립 전쟁, 보호 기간, 공격 횟수 제한.
 */

export type ShipDef = {
  tier: number;
  name: string;
  hp: number;
  atk: number;
  def: number;
  /** 동시에 쓸 수 있는 무기·방어구 수 */
  weaponSlots: number;
  armorSlots: number;
  price: number;
  desc: string;
};

export const SHIPS: ShipDef[] = [
  { tier: 0, name: "돛단배", hp: 60, atk: 8, def: 1, weaponSlots: 1, armorSlots: 1, price: 0, desc: "모든 해적의 시작" },
  { tier: 1, name: "통통배", hp: 90, atk: 11, def: 2, weaponSlots: 2, armorSlots: 1, price: 80, desc: "통통통… 엔진이 생겼다" },
  { tier: 2, name: "유람선", hp: 130, atk: 14, def: 4, weaponSlots: 2, armorSlots: 2, price: 200, desc: "관광객인 척 위장" },
  { tier: 3, name: "해적 갤리온", hp: 180, atk: 18, def: 6, weaponSlots: 3, armorSlots: 2, price: 400, desc: "검은 돛, 진짜 해적선" },
  { tier: 4, name: "철갑 함선", hp: 240, atk: 23, def: 9, weaponSlots: 3, armorSlots: 3, price: 700, desc: "포탑이 달린 강철 군함" },
  { tier: 5, name: "유령선", hp: 320, atk: 28, def: 12, weaponSlots: 4, armorSlots: 3, price: 1200, desc: "바다의 전설. 아무도 침몰시키지 못했다" },
];

export type ItemDef = { id: string; kind: "weapon" | "armor"; name: string; icon: string; power: number; price: number };

/** 무기(공격력)·방어구(방어력). 소모품: 해전마다 일정 확률로 부서진다 */
export const ITEMS: ItemDef[] = [
  { id: "sling", kind: "weapon", name: "돌팔매", icon: "🪨", power: 4, price: 10 },
  { id: "cannon", kind: "weapon", name: "대포", icon: "💣", power: 9, price: 30 },
  { id: "twin", kind: "weapon", name: "쌍열포", icon: "🧨", power: 15, price: 60 },
  { id: "missile", kind: "weapon", name: "미사일", icon: "🚀", power: 24, price: 110 },
  { id: "hyunmoo", kind: "weapon", name: "현무", icon: "☄️", power: 38, price: 200 },
  { id: "plank", kind: "armor", name: "나무 방패", icon: "🪵", power: 3, price: 10 },
  { id: "iron", kind: "armor", name: "철갑", icon: "🛡️", power: 7, price: 30 },
  { id: "steel", kind: "armor", name: "강철 장갑", icon: "🔩", power: 12, price: 60 },
  { id: "irondome", kind: "armor", name: "아이언돔", icon: "🔰", power: 19, price: 110 },
  { id: "blackhole", kind: "armor", name: "블랙홀", icon: "🕳️", power: 30, price: 200 },
];
export const ITEM_BUY_MAX = 10; // 한 번에 살 수 있는 개수

export type NpcRole = "cook" | "doctor" | "navigator" | "gunner" | "carpenter" | "lookout" | "parrot";
export type NpcDef = { role: NpcRole; name: string; icon: string; maxLevel: number; prices: number[]; effect: (lv: number) => string };

/** NPC 선원: 사람이 아닌 해적단 소속 캐릭터. 이름은 "[해적단명] 요리사" */
export const NPCS: NpcDef[] = [
  { role: "cook", name: "요리사", icon: "🍳", maxLevel: 3, prices: [40, 90, 160], effect: (lv) => `최대 체력 +${lv * 15}` },
  { role: "doctor", name: "의사", icon: "🩺", maxLevel: 3, prices: [40, 90, 160], effect: (lv) => `시간당 회복 +${lv * 3}%` },
  { role: "carpenter", name: "목수", icon: "🔨", maxLevel: 3, prices: [40, 90, 160], effect: (lv) => `방어 +${lv * 2}, 장비 파손 −${lv * 8}%p` },
  { role: "navigator", name: "1등 항해사", icon: "🧭", maxLevel: 3, prices: [50, 110, 190], effect: (lv) => `회피 +${lv * 5}%, 선제 포격` },
  { role: "lookout", name: "견시", icon: "🔭", maxLevel: 3, prices: [50, 110, 190], effect: (lv) => `명중 +${lv * 5}%` },
  { role: "gunner", name: "포수", icon: "💥", maxLevel: 3, prices: [50, 110, 190], effect: (lv) => `치명타 +${lv * 5}%` },
  { role: "parrot", name: "앵무새", icon: "🦜", maxLevel: 1, prices: [30], effect: () => "적 명중 −3%, 전투 중 약 올리기" },
];

export const NAVAL = {
  /** 해적단 이름 길이 */
  nameMin: 2,
  nameMax: 10,
  /** 기본 시간당 회복 (최대 체력 대비) */
  baseRegenPct: 5,
  /** 체력이 이 비율 미만이면 공격 불가 (수리 중) */
  minAttackHpPct: 30,
  /** 수리비: 잃은 체력 3당 1두블룬 */
  repairHpPerCoin: 3,
  maxRounds: 12,
  /** 휘하 기간과 상납 */
  vassalDays: 7,
  tributeRate: 20, // %
  tributeRateBully: 5, // 내 전투력의 절반도 안 되는 상대를 이겼을 때
  tributeRateUnderdog: 30, // 나보다 1.5배 강한 상대를 이겼을 때
  tributeCap: 100, // 휘하 1회당 최대 상납
  /** 전리품 (시스템 지급) */
  loot: 20,
  lootBully: 5,
  lootUnderdog: 40,
  defenseReward: 15,
  defenseRewardUnderdog: 30,
  /** 보호: 창단 직후, 휘하에서 풀린 직후 */
  newCrewProtectDays: 3,
  freedProtectDays: 3,
  /** 공격 제한 */
  raidsPerDay: 1,
  sameTargetDays: 7,
  /** 장비 파손 확률 (%) */
  breakWinner: 25,
  breakLoser: 40,
  breakMin: 5,
} as const;

export const TAUNTS = [
  "꽥! 그게 대포냐 콩알이냐!",
  "꽥! 너네 배에서 생선 냄새 난다!",
  "꽥! 항복하면 크래커는 남겨 줄게!",
  "꽥! 조준을 눈 감고 하냐!",
  "꽥! 우리 요리사가 더 무섭다!",
  "꽥! 돛 꿰매러 집에 가라!",
];

export type Loadout = {
  shipTier: number;
  items: Record<string, number>;
  npcs: Partial<Record<NpcRole, number>>;
};

export type CrewStats = {
  maxHp: number;
  atk: number;
  def: number;
  power: number;
  regenPerHour: number;
  hit: number; // 명중 보너스 %
  evade: number; // 회피 %
  crit: number; // 치명타 %
  initiative: number;
  taunt: boolean;
  /** 실제로 장착된 장비 (슬롯 수만큼 좋은 것부터) */
  equipped: { id: string; count: number }[];
  breakReduce: number;
};

export function shipOf(tier: number): ShipDef {
  return SHIPS[Math.max(0, Math.min(SHIPS.length - 1, tier))];
}
export function itemOf(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}
export function npcOf(role: string): NpcDef | undefined {
  return NPCS.find((n) => n.role === role);
}
export function npcName(crewName: string, role: NpcRole): string {
  return `${crewName} ${npcOf(role)?.name ?? role}`;
}

/** 슬롯 수만큼 강한 장비부터 장착 (1개 = 1칸) */
function equip(items: Record<string, number>, kind: "weapon" | "armor", slots: number) {
  const owned = ITEMS.filter((i) => i.kind === kind && (items[i.id] ?? 0) > 0).sort((a, b) => b.power - a.power);
  const out: { id: string; count: number; power: number }[] = [];
  let left = slots;
  for (const it of owned) {
    if (left <= 0) break;
    const n = Math.min(left, items[it.id]);
    out.push({ id: it.id, count: n, power: it.power * n });
    left -= n;
  }
  return out;
}

export function statsOf(l: Loadout): CrewStats {
  const ship = shipOf(l.shipTier);
  const lv = (r: NpcRole) => l.npcs[r] ?? 0;
  const weapons = equip(l.items, "weapon", ship.weaponSlots);
  const armors = equip(l.items, "armor", ship.armorSlots);
  const maxHp = ship.hp + lv("cook") * 15;
  const atk = ship.atk + weapons.reduce((s, w) => s + w.power, 0);
  const def = ship.def + armors.reduce((s, a) => s + a.power, 0) + lv("carpenter") * 2;
  return {
    maxHp,
    atk,
    def,
    power: Math.round(atk * 3 + def * 3 + maxHp / 2 + (lv("navigator") + lv("lookout") + lv("gunner")) * 6),
    regenPerHour: Math.round((maxHp * (NAVAL.baseRegenPct + lv("doctor") * 3)) / 100),
    hit: lv("lookout") * 5,
    evade: lv("navigator") * 5 + lv("parrot") * 3,
    crit: 12 + lv("gunner") * 5,
    initiative: lv("navigator"),
    taunt: lv("parrot") > 0,
    equipped: [...weapons, ...armors].map(({ id, count }) => ({ id, count })),
    breakReduce: lv("carpenter") * 8,
  };
}

/** 지금 체력: 저장된 체력 + 지난 시간만큼 회복 */
export function currentHp(hp: number, hpAt: Date | string, stats: CrewStats, now = Date.now()): number {
  const hours = Math.max(0, (now - new Date(hpAt).getTime()) / 3600_000);
  return Math.min(stats.maxHp, Math.floor(hp + hours * stats.regenPerHour));
}

export function repairCost(hp: number, maxHp: number): number {
  return Math.ceil(Math.max(0, maxHp - hp) / NAVAL.repairHpPerCoin);
}

export type Shot = {
  /** 쏜 쪽: a = 공격 해적단, d = 방어 해적단 */
  by: "a" | "d";
  hit: boolean;
  crit: boolean;
  dmg: number;
  hpA: number;
  hpD: number;
  taunt?: string;
};

export type BattleSim = { shots: Shot[]; attackerWon: boolean; hpA: number; hpD: number };

/** 자동 포격전. rng는 0~1 난수 (테스트용으로 바꿀 수 있게) */
export function simulate(
  a: CrewStats,
  d: CrewStats,
  hpA0: number,
  hpD0: number,
  rng: () => number = Math.random,
): BattleSim {
  let hpA = hpA0;
  let hpD = hpD0;
  const shots: Shot[] = [];
  // 항해사 레벨이 높은 쪽이 먼저 쏜다. 같으면 공격한 쪽
  const order: ("a" | "d")[] = d.initiative > a.initiative ? ["d", "a"] : ["a", "d"];
  for (let round = 0; round < NAVAL.maxRounds && hpA > 0 && hpD > 0; round++) {
    for (const by of order) {
      if (hpA <= 0 || hpD <= 0) break;
      const me = by === "a" ? a : d;
      const foe = by === "a" ? d : a;
      const hitChance = Math.min(95, Math.max(40, 78 + me.hit - foe.evade));
      const hit = rng() * 100 < hitChance;
      const crit = hit && rng() * 100 < me.crit;
      let dmg = 0;
      if (hit) {
        // 방어는 비율로 깎는다 (방어 40이면 절반). 운 폭을 넓게 둬 비슷한 상대끼리는 결과가 갈린다
        const raw = me.atk * (0.5 + rng()) * (crit ? 2 : 1);
        dmg = Math.max(1, Math.round((raw * 40) / (40 + foe.def)));
        if (by === "a") hpD = Math.max(0, hpD - dmg);
        else hpA = Math.max(0, hpA - dmg);
      }
      const shot: Shot = { by, hit, crit, dmg, hpA, hpD };
      // 앵무새가 있으면 가끔 약 올리기
      if (me.taunt && rng() < 0.3) shot.taunt = TAUNTS[Math.floor(rng() * TAUNTS.length)];
      shots.push(shot);
    }
  }
  let attackerWon: boolean;
  if (hpD <= 0) attackerWon = true;
  else if (hpA <= 0) attackerWon = false;
  else attackerWon = hpA / a.maxHp > hpD / d.maxHp; // 판정승. 같으면 지킨 쪽 승
  return { shots, attackerWon, hpA, hpD };
}

/** 전투력 차이에 따른 상납률·전리품 */
export function raidTerms(attackerPower: number, defenderPower: number) {
  if (attackerPower >= defenderPower * 2) {
    return { kind: "bully" as const, tributeRate: NAVAL.tributeRateBully, loot: NAVAL.lootBully, defense: NAVAL.defenseRewardUnderdog };
  }
  if (defenderPower >= attackerPower * 1.5) {
    return { kind: "underdog" as const, tributeRate: NAVAL.tributeRateUnderdog, loot: NAVAL.lootUnderdog, defense: NAVAL.defenseReward };
  }
  return { kind: "even" as const, tributeRate: NAVAL.tributeRate, loot: NAVAL.loot, defense: NAVAL.defenseReward };
}

/** 해적단 칭호: 해전 승수 기준 */
const CREW_TITLES: [number, string][] = [
  [20, "무적함대"],
  [10, "바다의 공포"],
  [5, "악명 높은 해적단"],
  [1, "신흥 해적단"],
  [0, "풋내기 해적단"],
];
export function crewTitle(wins: number): string {
  return CREW_TITLES.find(([n]) => wins >= n)![1];
}

/** 해적단 이름 검사 (한글·영문·숫자·공백) */
export function validCrewName(name: string): string | null {
  const n = name.trim();
  if (n.length < NAVAL.nameMin || n.length > NAVAL.nameMax) return `해적단 이름은 ${NAVAL.nameMin}~${NAVAL.nameMax}자예요.`;
  if (!/^[가-힣a-zA-Z0-9 ]+$/.test(n)) return "한글, 영문, 숫자만 쓸 수 있어요.";
  return null;
}

/** 부서진 장비 이름 목록 표시용 */
export function itemLabel(id: string, count: number): string {
  const it = itemOf(id);
  return it ? `${it.icon}${it.name}${count > 1 ? ` ×${count}` : ""}` : id;
}
