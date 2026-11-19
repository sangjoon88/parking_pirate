/**
 * 지도 정박지 핀 HTML (카카오 CustomOverlay content).
 * 배치 규칙:
 *  - 핀 몸통(도트) 끝이 실제 위치. 오버레이는 xAnchor 0.5, yAnchor 1 로 몸통 크기만 기준으로 잡는다.
 *  - 핀 위: 영주 깃발 하나 (지난달 해적왕이 영주면 왕관)
 *  - 핀 아래: 상태 태그 한 줄 (⚠ 해군 · ⚓ 정박 인원 · 💰 현상금 · 📦 보물)
 *  - 위·아래 장식은 absolute라 핀 기준점에 영향을 주지 않는다.
 */
import { STALE_DAYS } from "./constants";
import { guardColor } from "./format";
import { FLEET_SIZE } from "./game";
import { chestSvg, pinSvg, spriteSvg } from "./pixelSprites";
import type { SpotSummary } from "./types";

export const PIN_SCALE = 3; // 14x16 도트 → 42x48px

/** 영주 깃발 (9x9): 깃대 + 빨간 삼각기 */
export function pennantSvg(scale: number) {
  return spriteSvg(
    ["PRRRRR...", "PRRWRRR..", "PRRRRRRR.", "PRRRRR...", "PRR......", "P........", "P........", "P........", "p........"],
    { P: "#d6b98a", p: "#8a5a2b", R: "#dc2626", W: "#f4f1e8" },
    scale,
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

function tag(bg: string, fg: string, text: string, extra = "") {
  return `<span style="display:inline-block;height:15px;padding:0 3px;background:${bg};color:${fg};font:800 10px/11px ui-monospace,Menlo,monospace;white-space:nowrap;border:2px solid #0b1220;box-shadow:1px 1px 0 rgba(0,0,0,.6);${extra}">${text}</span>`;
}

export function isStale(s: SpotSummary, now = Date.now()): boolean {
  if (s.status === "closed") return false;
  return !s.lastConfirmedAt || now - new Date(s.lastConfirmedAt).getTime() > STALE_DAYS * 86400_000;
}

export function pinHtml(s: SpotSummary, selected: boolean): string {
  const closed = s.status === "closed";
  const fleet = s.parkedCount >= FLEET_SIZE;
  const body = pinSvg({
    color: guardColor(s.guardAvg, closed),
    outline: s.legendary || selected ? "#f5c451" : "#0b1220",
    glyph: closed ? "gate" : fleet ? "ship" : "skull",
    scale: PIN_SCALE,
  });
  const shadow = s.legendary
    ? "drop-shadow(0 0 5px rgba(245,196,81,.95)) drop-shadow(2px 2px 0 rgba(0,0,0,.5))"
    : "drop-shadow(2px 2px 0 rgba(0,0,0,.5))";

  // 핀 위: 영주 표시 하나
  const top = s.kingDomain
    ? `<div style="position:absolute;bottom:calc(100% - 3px);left:50%;transform:translateX(-50%);filter:drop-shadow(1px 1px 0 #0b1220)">${crownSvg(2)}</div>`
    : s.lord
      ? `<div style="position:absolute;bottom:calc(100% - 6px);left:calc(50% - 1px);filter:drop-shadow(1px 1px 0 #0b1220)">${pennantSvg(2)}</div>`
      : "";

  // 핀 아래: 상태 태그 한 줄
  const tags = [
    s.navyAlert ? tag("#dc2626", "#fff", "⚠", "animation:pp-blink 1s steps(2) infinite") : "",
    s.parkedCount > 0 ? tag("#f5c451", "#0b1220", `⚓${s.parkedCount}`) : "",
    s.bounty > 0 ? tag("#16a34a", "#fff", `💰${s.bounty}`) : "",
    s.treasure ? `<span style="display:inline-block;animation:pp-bob-y 1.2s steps(2) infinite">${chestSvg(2)}</span>` : "",
  ].filter(Boolean);
  const bottom = tags.length
    ? `<div style="position:absolute;top:calc(100% + 2px);left:50%;transform:translateX(-50%);display:flex;gap:2px;align-items:center">${tags.join("")}</div>`
    : "";

  return `
    <div data-spot="${s.id}" style="position:relative;cursor:pointer;transform:scale(${selected ? 1.2 : 1});transform-origin:bottom center">
      ${top}
      <div style="opacity:${isStale(s) ? 0.5 : 1};filter:${shadow}">${body}</div>
      ${bottom}
    </div>`;
}
