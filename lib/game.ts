/** 재미 요소 규칙 (서버·클라이언트 공용) */

export const REWARD = {
  discovery: 50, // 정박지 발견
  newCell: 30, // 해도의 새 해역을 밝힘 (발견 보너스)
  report: 10, // 항해 일지 (같은 정박지는 6시간에 한 번만 지급)
  parking: 5, // 정박 (3시간에 한 번만 지급)
  fleet: 15, // 함대 집결 (같은 정박지 3명 이상)
  wonder: 10, // 내가 찍은 궁금한 곳에 누군가 정박지를 등록해 줌
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

export type BadgeId =
  | "pioneer"
  | "night"
  | "streak"
  | "fleet"
  | "hunter"
  | "scout"
  | "cartographer"
  | "lord"
  | "treasure"
  | "duelist"
  | "veteran";

export const BADGES: Record<BadgeId, { icon: string; name: string; desc: string }> = {
  pioneer: { icon: "🚩", name: "개척자", desc: "정박지를 처음 발견" },
  cartographer: { icon: "🗺️", name: "해도 개척자", desc: "여의도 해도의 새 해역을 밝힘" },
  night: { icon: "🌙", name: "야간 항해자", desc: "밤 10시~새벽 5시 정박 10회" },
  streak: { icon: "📅", name: "개근 선원", desc: "7일 연속 정박" },
  fleet: { icon: "⛵", name: "함대 집결", desc: "한 정박지에 3명 이상 함께 정박" },
  hunter: { icon: "💰", name: "현상금 사냥꾼", desc: "현상금 3회 획득" },
  scout: { icon: "🔭", name: "정찰병", desc: "항해 일지 20개 작성" },
  lord: { icon: "🏰", name: "영주", desc: "정박지의 영주가 됨" },
  treasure: { icon: "📦", name: "보물 사냥꾼", desc: "보물상자나 묻힌 보물 발견" },
  duelist: { icon: "⚔️", name: "결투왕", desc: "결투에서 승리" },
  veteran: { icon: "🎖️", name: "100일 선원", desc: "승선 100일" },
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

/* ───────── 3차 재미 요소 ───────── */

export const TOLL = 2; // 영주가 받는 통행세 (다른 선원이 정박 금화를 받을 때)
export const LORD_WINDOW_DAYS = 30; // 최근 30일 정박 횟수로 영주 결정
export const LORD_MIN_PARKINGS = 2;
export const LEGEND_PARKINGS = 100; // 누적 정박 100회면 전설의 정박지
export const TREASURE_MIN = 20;
export const TREASURE_MAX = 100;
export const RADIO_MAX_LEN = 60;
export const RADIO_TTL_MINUTES = 60;
export const RADIO_COOLDOWN_MINUTES = 3;
export const WONDER_NOTE_MAX = 100;
export const WONDER_MAX_OPEN = 10; // 한 선원이 동시에 찍어 둘 수 있는 궁금한 곳
export const DESCRIPTION_MAX = 500;

/* 사진 (DB 저장: Neon 무료 0.5GB 안에서 쓰도록 크기·개수 제한) */
export const PHOTO_MAX_EDGE = 1280; // 긴 변 픽셀 (브라우저에서 줄임)
export const PHOTO_MAX_BYTES = 700 * 1024; // 한 장 최대
export const SPOT_PHOTO_MAX = 12; // 정박지 소개 사진 최대 장수
export const PHOTO_TOTAL_MAX_BYTES = 400 * 1024 * 1024; // 전체 사진 용량 상한
export const DUEL_DAYS = 7;
export const DUEL_PENDING_DAYS = 2;
export const DUEL_STAKES = [20, 50, 100, 200] as const;

/** 승선 기념일 보상 */
export const ANNIVERSARIES: { days: number; label: string; reward: number }[] = [
  { days: 30, label: "승선 한 달", reward: 30 },
  { days: 100, label: "승선 100일", reward: 100 },
  { days: 365, label: "승선 1주년", reward: 365 },
];

/* 상점 */
export const FLAGS = ["☠", "🏴‍☠️", "🦜", "🦈", "⚓", "💀", "🐙", "🦑", "🐳", "🔱", "⚔️", "🍺"] as const;
export const NAME_COLORS: { id: string; label: string; color: string }[] = [
  { id: "gold", label: "황금", color: "#f5c451" },
  { id: "ruby", label: "루비", color: "#fb7185" },
  { id: "emerald", label: "에메랄드", color: "#34d399" },
  { id: "sapphire", label: "사파이어", color: "#60a5fa" },
  { id: "amethyst", label: "자수정", color: "#c084fc" },
  { id: "pearl", label: "진주", color: "#f8fafc" },
];
export const SHOP_PRICE = { flag: 100, color: 150 } as const;
export const BOUNTY_POST = { min: 10, max: 200 };
export const STASH = { min: 10, max: 200 };

export function colorOf(id: string | null | undefined): string | undefined {
  return NAME_COLORS.find((c) => c.id === id)?.color;
}

/* 바다 날씨: 주(월요일 시작, KST)마다 바뀜 */
export type WeatherId = "calm" | "storm" | "fog" | "tailwind";
export const WEATHERS: Record<WeatherId, { icon: string; name: string; desc: string }> = {
  calm: { icon: "☀️", name: "잔잔한 바다", desc: "평범한 한 주" },
  storm: { icon: "🌪", name: "폭풍 주간", desc: "항해 일지 금화 2배" },
  fog: { icon: "🌫", name: "안개 주간", desc: "현상금 2배" },
  tailwind: { icon: "🌊", name: "순풍 주간", desc: "정박 금화 2배" },
};

/** KST 기준 이번 주 월요일 날짜 문자열 */
function kstWeekKey(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const dow = (kst.getUTCDay() + 6) % 7; // 월=0
  const monday = new Date(kst.getTime() - dow * 86400_000);
  return monday.toISOString().slice(0, 10);
}

export function weatherFor(now = new Date()): WeatherId {
  const key = kstWeekKey(now);
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const order: WeatherId[] = ["calm", "storm", "fog", "tailwind"];
  return order[h % order.length];
}

/** 날씨 배율 적용 */
export function boosted(kind: "report" | "bounty" | "parking", amount: number, now = new Date()): number {
  const w = weatherFor(now);
  const double = (w === "storm" && kind === "report") || (w === "fog" && kind === "bounty") || (w === "tailwind" && kind === "parking");
  return double ? amount * 2 : amount;
}

export function kstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
