/** 재미 요소 규칙 (서버·클라이언트 공용) */

export const REWARD = {
  discovery: 50, // 정박지 발견
  newCell: 30, // 해도의 새 해역을 밝힘 (발견 보너스)
  report: 10, // 항해 일지 (같은 정박지는 6시간에 한 번만 지급)
  parking: 5, // 정박 (3시간에 한 번만 지급)
  fleet: 15, // 함대 집결 (같은 정박지 3명 이상)
  banPenalty: -100, // 내가 추천한 선원이 추방되면
} as const;

export const REPORT_COOLDOWN_HOURS = 6;
export const PARKING_REWARD_COOLDOWN_HOURS = 3;
export const FLEET_SIZE = 3;
export const NAVY_ALERT_MINUTES = 30;

/** 추천인 몫: 내가 데려온 선원이 번 금화의 10% (최소 1) */
export function lineageShare(amount: number): number {
  return amount > 0 ? Math.max(1, Math.floor(amount / 10)) : 0;
}

/** 현상금: 마지막 확인 후 7일이 지나면 20, 하루마다 +5, 최대 100 */
export const BOUNTY_START_DAYS = 7;
export function bountyFor(lastConfirmedAt: string | Date | null, createdAt: string | Date, now = Date.now()): number {
  const base = new Date(lastConfirmedAt ?? createdAt).getTime();
  const days = Math.floor((now - base) / 86400_000);
  if (days < BOUNTY_START_DAYS) return 0;
  return Math.min(100, 20 + (days - BOUNTY_START_DAYS) * 5);
}

/** 칭호: 발견한 정박지 수 기준 */
const TITLES: [number, string][] = [
  [20, "대해적"],
  [10, "선장"],
  [5, "갑판장"],
  [1, "견습 해적"],
  [0, "신입 선원"],
];
export function titleFor(discoveries: number): string {
  return TITLES.find(([n]) => discoveries >= n)![1];
}
export function nextTitle(discoveries: number): { title: string; need: number } | null {
  const next = [...TITLES].reverse().find(([n]) => n > discoveries);
  return next ? { title: next[1], need: next[0] - discoveries } : null;
}

export type BadgeId = "pioneer" | "night" | "streak" | "fleet" | "hunter" | "scout" | "cartographer";

export const BADGES: Record<BadgeId, { icon: string; name: string; desc: string }> = {
  pioneer: { icon: "🚩", name: "개척자", desc: "정박지를 처음 발견" },
  cartographer: { icon: "🗺️", name: "해도 개척자", desc: "여의도 해도의 새 해역을 밝힘" },
  night: { icon: "🌙", name: "야간 항해자", desc: "밤 10시~새벽 5시 정박 10회" },
  streak: { icon: "📅", name: "개근 선원", desc: "7일 연속 정박" },
  fleet: { icon: "⛵", name: "함대 집결", desc: "한 정박지에 3명 이상 함께 정박" },
  hunter: { icon: "💰", name: "현상금 사냥꾼", desc: "현상금 3회 획득" },
  scout: { icon: "🔭", name: "정찰병", desc: "항해 일지 20개 작성" },
};

export const FORTUNES = [
  "순풍이 분다. 오늘은 무사할 것이다.",
  "갈매기가 조용하다. 좋은 징조다.",
  "경비 초소에 불이 꺼져 있다. 운이 좋다.",
  "선장의 직감: 오늘은 오래 머물지 마라.",
  "바다가 잔잔하다. 편히 쉬어라.",
  "먹구름이 보인다. 출항 시간을 잊지 마라.",
  "보물은 가까이에 있다. 일지를 남겨라.",
  "해군의 순찰선이 멀리 있다. 안심해도 좋다.",
  "럼주 한 잔의 여유가 있는 날이다. (운전자는 금지)",
  "오늘의 행운 숫자는 7. 7번째 칸을 노려라.",
  "북쪽 바람이 차다. 따뜻하게 입어라.",
  "동료 해적이 근처에 있다. 함대를 꾸려 보라.",
  "지도에 없는 섬이 있다. 새 정박지를 찾아라.",
  "닻이 단단히 내려졌다. 걱정 마라.",
  "오늘 밤 별이 밝다. 야간 항해에 좋은 날이다.",
];

export function randomFortune(): string {
  return FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
}
