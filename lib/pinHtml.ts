/**
 * 지도 정박지 핀 HTML (카카오 CustomOverlay content): 해적 깃발.
 * 배치 규칙:
 *  - 깃대 받침이 실제 위치. 오버레이는 xAnchor = PIN_X_ANCHOR, yAnchor 1 (깃발 그림 크기만 기준).
 *  - 깃발 천 색 = 경계 레벨 (빛바랜 해적 톤). 정보 없으면 검은 해골 깃발, 닫히면 찢어진 회색 깃발.
 *  - 깃대 꼭대기: 영주가 있으면 작은 성, 지난달 해적왕이 영주면 왕관.
 *  - 정박 중이면 깃발 옆에 그 선원들의 해적단 배(해전과 같은 도트 배)가 최대 3척 정박.
 *  - 깃발 아래: 상태 태그 한 줄 (⚠ 해군 · ⚓ 정박 인원 · 💰 현상금 · 📦 보물)
 *  - 깃발은 두 장면을 번갈아 보여 펄럭인다.
 */
import { STALE_DAYS } from "./constants";
import { PX_ICONS, PX_PALETTE } from "./pixelIcons";
import { chestSvg, spriteSvg } from "./pixelSprites";
import { SHIP_PALETTE, SHIP_ROWS } from "./shipSprites";
import type { SpotSummary } from "./types";

export const PIN_SCALE = 3;
export const COMPACT_SCALE = 2;
const FLAG_W = 16;
/** 깃대 받침 가운데 (16칸 중 2.5칸) */
export const PIN_X_ANCHOR = 2.5 / FLAG_W;

/** 경계 레벨 → 깃발 천 색 (빛바랜 해적 톤). null = 정보 없음(검은 깃발) */
export function pirateColor(avg: number | null, closed: boolean): string {
  if (closed) return "#7a7468";
  if (avg == null) return "#1a1d2b";
  if (avg < 1.8) return "#4f7d55"; // 이끼 초록: 느슨
  if (avg < 2.6) return "#8c8a3e"; // 올리브
  if (avg < 3.4) return "#c08a2b"; // 황토
  if (avg < 4.2) return "#b0532c"; // 녹슨 주황
  return "#8b1e1e"; // 핏빛: 엄격
}

// 깃발 두 장면 (16x17). c 천, d 천 그늘, W 해골, k 눈, n 깃대, Y 꼭대기 장식
const FLAG_A = [
  ".KK.............",
  "KYYK............",
  ".KnKKKKKKKKKK...",
  ".KnKcccccccccK..",
  ".KnKccWWWWccccK.",
  ".KnKcWWWWWWcccK.",
  ".KnKcWkWWkWccK..",
  ".KnKccWkkWcccK..",
  ".KnKcccWWccccK..",
  ".KnKddddddddK...",
  ".KnKKKKKKKKK....",
  ".KnK............",
  ".KnK............",
  ".KnK............",
  "KKnKK...........",
  "KnnnnK..........",
  ".KKKK...........",
];
const FLAG_B = [
  ".KK.............",
  "KYYK............",
  ".KnKKKKKKKKK....",
  ".KnKccccccccKK..",
  ".KnKccWWWWccccK.",
  ".KnKcWWWWWWccccK",
  ".KnKcWkWWkWcccK.",
  ".KnKccWkkWccccK.",
  ".KnKcccWWcccccK.",
  ".KnKdddddddddK..",
  ".KnKKKKKKKKKKK..",
  ".KnK............",
  ".KnK............",
  ".KnK............",
  "KKnKK...........",
  "KnnnnK..........",
  ".KKKK...........",
];
// 닫힌 정박지: 구멍 나고 찢어진 깃발
const FLAG_TORN = [
  ".KK.............",
  "KYYK............",
  ".KnKKKKKKKK.....",
  ".KnKcccccccK....",
  ".KnKcc.ccccKK...",
  ".KnKcccccc.K....",
  ".KnKccccKK.K....",
  ".KnKcc.cK.......",
  ".KnKcccK........",
  ".KnKddK.........",
  ".KnKKK..........",
  ".KnK............",
  ".KnK............",
  ".KnK............",
  "KKnKK...........",
  "KnnnnK..........",
  ".KKKK...........",
];

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function flagSvg(color: string, opts: { closed?: boolean; frame?: 0 | 1; scale?: number; gold?: boolean } = {}) {
  const rows = opts.closed ? FLAG_TORN : opts.frame ? FLAG_B : FLAG_A;
  const black = color === "#1a1d2b";
  return spriteSvg(
    rows,
    {
      K: "#0b1220",
      c: color,
      d: black ? "#2a2f45" : shade(color, 0.72),
      W: "#efe6d0",
      k: black ? "#0b1220" : shade(color, 0.45),
      n: "#6b4423",
      Y: opts.gold ? "#fde047" : "#d6b98a",
    },
    opts.scale ?? PIN_SCALE,
  );
}

/** 해적왕 왕관 (9x6) */
export function crownSvg(scale: number) {
  return spriteSvg(
    ["Y...Y...Y", "YY.YYY.YY", "YYYYYYYYY", "YRYYBYYRY", "YYYYYYYYY", "ooooooooo"],
    { Y: "#f5c451", R: "#dc2626", B: "#3b82f6", o: "#b8860b" },
    scale,
  );
}

/** 영주의 성 (도트 아이콘) */
export function castleSvg(scale: number) {
  return spriteSvg(PX_ICONS.castle, PX_PALETTE, scale);
}

export function shipMapSvg(tier: number, scale = 2) {
  return spriteSvg(SHIP_ROWS[Math.max(0, Math.min(SHIP_ROWS.length - 1, tier))], SHIP_PALETTE, scale);
}

/** 태그 안 작은 도트 아이콘 */
function ico(name: keyof typeof PX_ICONS) {
  return spriteSvg(PX_ICONS[name], PX_PALETTE, 1.1, "display:inline-block;vertical-align:-2px;margin-right:1px");
}

function tag(bg: string, fg: string, text: string, extra = "") {
  return `<span style="display:inline-block;height:15px;padding:0 3px;background:${bg};color:${fg};font:800 10px/11px ui-monospace,Menlo,monospace;white-space:nowrap;border:2px solid #0b1220;box-shadow:1px 1px 0 rgba(0,0,0,.6);${extra}">${text}</span>`;
}

export function isStale(s: SpotSummary, now = Date.now()): boolean {
  if (s.status === "closed") return false;
  return !s.lastConfirmedAt || now - new Date(s.lastConfirmedAt).getTime() > STALE_DAYS * 86400_000;
}

/**
 * compact: 지도를 멀리서 볼 때 쓰는 작은 깃발 (배는 숨기고 태그는 아이콘 위주).
 * 깃발 그림 비율이 같아서 PIN_X_ANCHOR는 그대로 맞는다.
 */
export function pinHtml(s: SpotSummary, selected: boolean, compact = false): string {
  const closed = s.status === "closed";
  const color = pirateColor(s.guardAvg, closed);
  const px = compact ? COMPACT_SCALE : PIN_SCALE;
  const shadow = s.legendary
    ? "drop-shadow(0 0 5px rgba(245,196,81,.95)) drop-shadow(2px 2px 0 rgba(0,0,0,.5))"
    : "drop-shadow(2px 2px 0 rgba(0,0,0,.5))";

  // 펄럭임: 두 장면을 번갈아 (닫힌 깃발은 가만히)
  const flag = closed
    ? flagSvg(color, { closed: true, gold: s.legendary, scale: px })
    : `<div style="position:relative">${flagSvg(color, { frame: 0, gold: s.legendary, scale: px })}<div style="position:absolute;inset:0;animation:pp-flap 1.1s steps(1) infinite">${flagSvg(color, { frame: 1, gold: s.legendary, scale: px })}</div></div>`;

  // 깃대 꼭대기: 왕관(해적왕의 영지) 또는 성(영주)
  const poleX = 2.5 * px;
  const top = s.kingDomain
    ? `<div style="position:absolute;bottom:calc(100% - 4px);left:${poleX}px;transform:translateX(-50%);filter:drop-shadow(1px 1px 0 #0b1220)">${crownSvg(compact ? 1.3 : 2)}</div>`
    : s.lord
      ? `<div style="position:absolute;bottom:calc(100% - 3px);left:${poleX}px;transform:translateX(-50%);filter:drop-shadow(1px 1px 0 #0b1220)">${castleSvg(compact ? 1.2 : 1.8)}</div>`
      : "";

  // 정박 중인 배: 깃대 오른쪽 아래에 최대 3척, 뒤로 갈수록 살짝 위·오른쪽
  const ships = (compact ? [] : s.parkedShips)
    .slice(0, 3)
    .map(
      (tier, i) =>
        `<div style="position:absolute;left:${poleX + 4 + i * 24}px;bottom:${-6 + i * 3}px;z-index:${3 - i};filter:drop-shadow(1px 1px 0 rgba(0,0,0,.45));animation:pp-bob-y ${1.4 + i * 0.2}s steps(2) infinite">${shipMapSvg(tier, 1.6)}</div>`,
    )
    .reverse()
    .join("");

  const tags = [
    s.navyAlert ? tag("#dc2626", "#fff", ico("warn"), "animation:pp-blink 1s steps(2) infinite") : "",
    s.parkedCount > 0 ? tag("#f5c451", "#0b1220", `${ico("anchor")}${s.parkedCount}`) : "",
    s.bounty > 0 ? tag("#16a34a", "#fff", compact ? ico("coin") : `${ico("coin")}${s.bounty}`) : "",
    s.treasure ? `<span style="display:inline-block;animation:pp-bob-y 1.2s steps(2) infinite">${chestSvg(compact ? 1.4 : 2)}</span>` : "",
  ].filter(Boolean);
  const bottom = tags.length
    ? `<div style="position:absolute;top:calc(100% + ${!compact && s.parkedShips.length ? 8 : 2}px);left:${poleX}px;transform:translateX(-50%);display:flex;gap:2px;align-items:center">${tags.join("")}</div>`
    : "";

  return `
    <div data-spot="${s.id}" style="position:relative;width:${FLAG_W * px}px;cursor:pointer;transform:scale(${selected ? 1.2 : 1});transform-origin:${poleX}px 100%">
      ${top}
      <div style="opacity:${isStale(s) ? 0.55 : 1};filter:${shadow}">${flag}</div>
      ${ships}
      ${bottom}
    </div>`;
}

/**
 * 겹친 정박지 묶음: 깃발 두 개를 겹쳐 그리고 개수 표시.
 * 안에 해군·보물·현상금·정박 중인 곳이 있으면 아래에 작은 아이콘으로 알려 준다.
 * 오버레이는 xAnchor 0.5, yAnchor 1.
 */
export function clusterHtml(spots: SpotSummary[]): string {
  const sorted = [...spots].sort((a, b) => (b.guardAvg ?? 0) - (a.guardAvg ?? 0));
  const back = flagSvg(pirateColor(sorted[1]?.guardAvg ?? null, false), { scale: 2 });
  const front = flagSvg(pirateColor(sorted[0].guardAvg, sorted[0].status === "closed"), { scale: 2 });
  const parked = spots.reduce((n, s) => n + s.parkedCount, 0);
  const extras = [
    spots.some((s) => s.navyAlert) ? ico("warn") : "",
    spots.some((s) => s.treasure) ? ico("chest") : "",
    spots.some((s) => s.bounty > 0) ? ico("coin") : "",
    parked > 0 ? `${ico("anchor")}${parked}` : "",
  ].filter(Boolean);
  return `
    <div data-spot="cluster" style="position:relative;width:46px;height:40px;cursor:pointer;filter:drop-shadow(2px 2px 0 rgba(0,0,0,.5))">
      <div style="position:absolute;left:12px;bottom:4px">${back}</div>
      <div style="position:absolute;left:0;bottom:0">${front}</div>
      <span style="position:absolute;left:38px;top:-10px;height:17px;padding:0 3px;background:#f4ead2;color:#2b1d0e;border:2px solid #0b1220;font:900 11px/13px ui-monospace,Menlo,monospace;white-space:nowrap;box-shadow:1px 1px 0 rgba(0,0,0,.6)">×${spots.length}</span>
      ${extras.length ? `<div style="position:absolute;top:calc(100% + 2px);left:50%;transform:translateX(-50%);display:flex">${tag("#0b1a2e", "#fff", extras.join(" "))}</div>` : ""}
    </div>`;
}
