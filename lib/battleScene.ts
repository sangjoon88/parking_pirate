/**
 * 해전 장면 그리기 (캔버스, 192x108 저해상도 → 화면에서 픽셀 그대로 확대).
 * 하늘·구름·출렁이는 바다·배·포탄 궤적·폭발·물보라·침몰을 시간(ms)만으로 계산해 그린다.
 * React와 무관한 순수 그리기 코드라, 같은 시간이면 항상 같은 그림이 나온다.
 */
import type { BattleLog } from "./fleetTypes";
import { SHIP_PALETTE, SHIP_ROWS } from "./shipSprites";

export const W = 192;
export const H = 108;
const SEA_Y = 70; // 바다 수면 기준
const HORIZON = 52;
const SHIP_SCALE = 3;
const X_A = 44;
const X_D = 148;

/** 타임라인 (ms) */
export const T = { intro: 700, shot: 1000, flight: 0.55, sink: 2400 };

export function shotTime(i: number) {
  return T.intro + i * T.shot;
}
export function endTime(log: BattleLog) {
  return T.intro + log.shots.length * T.shot;
}

/** 시드 난수: 같은 (i, k)면 같은 값 */
function rnd(i: number, k: number) {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function wave(x: number, t: number) {
  return 1.7 * Math.sin(x * 0.11 + t * 0.0021) + 0.9 * Math.sin(x * 0.27 - t * 0.0034 + 1.3);
}

/* ───── 3x5 도트 글꼴 (데미지 숫자) ───── */
const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "-": ["000", "000", "111", "000", "000"],
  "!": ["010", "010", "010", "000", "010"],
  M: ["101", "111", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  S: ["111", "100", "111", "001", "111"],
};
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, scale = 1) {
  const w = s.length * 4 * scale - scale;
  let cx = Math.round(x - w / 2);
  for (const ch of s) {
    const g = FONT[ch];
    if (g) {
      // 검은 테두리 먼저
      ctx.fillStyle = "#0b1220";
      g.forEach((row, ry) =>
        [...row].forEach((b, rx) => {
          if (b === "1") ctx.fillRect(cx + rx * scale - 1, Math.round(y) + ry * scale - 1, scale + 2, scale + 2);
        }),
      );
      ctx.fillStyle = color;
      g.forEach((row, ry) =>
        [...row].forEach((b, rx) => {
          if (b === "1") ctx.fillRect(cx + rx * scale, Math.round(y) + ry * scale, scale, scale);
        }),
      );
    }
    cx += 4 * scale;
  }
}

/* ───── 배 그림 (미리 한 번 그려 둔다) ───── */
const shipCache = new Map<number, HTMLCanvasElement>();
function shipCanvas(tier: number): HTMLCanvasElement {
  const hit = shipCache.get(tier);
  if (hit) return hit;
  const rows = SHIP_ROWS[Math.max(0, Math.min(SHIP_ROWS.length - 1, tier))];
  const c = document.createElement("canvas");
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext("2d")!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = SHIP_PALETTE[ch];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }),
  );
  shipCache.set(tier, c);
  return c;
}

type Pt = { x: number; y: number };

function shipPos(side: "a" | "d", t: number): Pt {
  const x = side === "a" ? X_A : X_D;
  return { x, y: SEA_Y + wave(x, t) };
}

/** 배 한 척: 물결 따라 흔들리고, 맞으면 덜컹, 지면 기울며 가라앉음 */
function drawShip(
  ctx: CanvasRenderingContext2D,
  tier: number,
  side: "a" | "d",
  t: number,
  opts: { shake: boolean; sink: number; winner: boolean; ended: boolean },
) {
  const img = shipCanvas(tier);
  const p = shipPos(side, t);
  const flip = side === "d";
  const slope = (wave(p.x + 8, t) - wave(p.x - 8, t)) / 16;
  const dir = flip ? 1 : -1;
  ctx.save();
  ctx.translate(Math.round(p.x + (opts.shake ? (Math.floor(t / 40) % 2 ? 1 : -1) : 0)), Math.round(p.y + opts.sink * 44));
  ctx.rotate(slope * 0.6 + opts.sink * 0.55 * dir);
  if (flip) ctx.scale(-1, 1);
  if (tier === 5) ctx.globalAlpha = 0.85;
  // 배 그림의 9번째 줄(선체 중간)이 수면에 오게
  ctx.drawImage(img, -Math.round((img.width * SHIP_SCALE) / 2), -9 * SHIP_SCALE, img.width * SHIP_SCALE, img.height * SHIP_SCALE);
  ctx.globalAlpha = 1;
  // 돛대 위 깃발 (펄럭임 2프레임). 이기면 금색 큰 깃발
  if (opts.sink < 0.6) {
    const big = opts.ended && opts.winner;
    const frame = Math.floor(t / (big ? 160 : 300)) % 2;
    const fx = -2;
    const fy = -9 * SHIP_SCALE - (big ? 12 : 9);
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(fx, fy, 1, big ? 12 : 9);
    // 삼각기: 세로 길이가 줄어드는 기둥들, 프레임마다 끝이 1칸 위아래로
    const len = big ? 9 : 6;
    const h0 = big ? 6 : 4;
    ctx.fillStyle = big ? "#f5c451" : side === "a" ? "#dc2626" : "#1a1d2b";
    for (let i = 0; i < len; i++) {
      const hh = Math.max(1, Math.round(h0 * (1 - i / len)));
      const wob = i > len / 2 ? (frame ? 1 : 0) : 0;
      ctx.fillRect(fx + 1 + i, fy + Math.floor((h0 - hh) / 2) + wob, 1, hh);
    }
    ctx.fillStyle = big ? "#b8860b" : "#f4f1e8";
    ctx.fillRect(fx + 2, fy + Math.floor(h0 / 2) - 1, 2, 2);
  }
  ctx.restore();
}

function drawSky(ctx: CanvasRenderingContext2D, t: number) {
  const bands = ["#4ea6e0", "#63b2e6", "#7cc0ec", "#98cef1", "#b7ddf5"];
  const bh = Math.ceil(HORIZON / bands.length);
  bands.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * bh, W, bh);
    // 띠 경계는 체크무늬로 섞는다 (도트 그러데이션)
    if (i > 0) {
      ctx.fillStyle = bands[i - 1];
      for (let x = 0; x < W; x += 2) ctx.fillRect(x + (i % 2), i * bh, 1, 1);
    }
  });
  // 해
  ctx.fillStyle = "#fde68a";
  for (let dy = -6; dy <= 6; dy++) {
    const half = Math.floor(Math.sqrt(36 - dy * dy));
    ctx.fillRect(166 - half, 14 + dy, half * 2, 1);
  }
  ctx.fillStyle = "#fff7c2";
  ctx.fillRect(162, 11, 3, 2);
  // 구름 3개, 천천히 흘러감
  [
    [10, 10, 0.004],
    [90, 22, 0.0025],
    [140, 6, 0.0032],
  ].forEach(([bx, by, sp], i) => {
    const x = Math.round(((bx + t * sp) % (W + 40)) - 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 4, by, 14, 3);
    ctx.fillRect(x, by + 3, 24, 3);
    ctx.fillRect(x + 8, by - 2, 6, 2);
    ctx.fillStyle = "#dbeafe";
    ctx.fillRect(x + 1, by + 6, 22, 1);
    if (i === 1) ctx.fillRect(x + 20, by + 2, 6, 3);
  });
  // 먼 바다
  // 먼 바다는 화면 끝까지 칠해 둔다 (앞 파도가 내려가도 틈이 안 보이게)
  ctx.fillStyle = "#3c84c4";
  ctx.fillRect(0, HORIZON, W, H - HORIZON);
  ctx.fillStyle = "#5d9ed6";
  for (let y = HORIZON + 2; y < SEA_Y - 2; y += 4) {
    const off = Math.floor(t * 0.01 + y * 3) % 24;
    for (let x = -24 + off; x < W; x += 24) ctx.fillRect(x, y, 6, 1);
  }
  ctx.fillStyle = "#cfe8f7";
  ctx.fillRect(0, HORIZON, W, 1);
}

/** 앞쪽 바다: 배 아랫부분을 덮어 물에 떠 있는 것처럼 보이게 */
function drawSea(ctx: CanvasRenderingContext2D, t: number) {
  for (let x = 0; x < W; x++) {
    const y = Math.round(SEA_Y + wave(x, t)) + 2;
    ctx.fillStyle = "#2f74b8";
    ctx.fillRect(x, y, 1, 8);
    ctx.fillStyle = "#245d9a";
    ctx.fillRect(x, y + 8, 1, 12);
    ctx.fillStyle = "#1b4a7e";
    ctx.fillRect(x, y + 20, 1, H - y - 20);
    // 물마루: 밝은 선 + 가끔 흰 거품
    ctx.fillStyle = "#9fd2f2";
    ctx.fillRect(x, y, 1, 1);
    if (Math.sin(x * 0.5 + t * 0.006) > 0.85) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y - 1, 1, 1);
    }
  }
  // 깊은 곳의 반짝이는 결
  ctx.fillStyle = "#3b86c9";
  for (let row = 0; row < 4; row++) {
    const y = SEA_Y + 10 + row * 8;
    const off = Math.floor(t * (0.012 + row * 0.004)) % 32;
    for (let x = -32 + ((off + row * 11) % 32); x < W; x += 32) ctx.fillRect(x, y, 8, 1);
  }
}

type ShotGeo = { from: Pt; to: Pt; target: "a" | "d" };

function shotGeo(by: "a" | "d", hit: boolean, i: number, t: number): ShotGeo {
  const shooter = shipPos(by, t);
  const target: "a" | "d" = by === "a" ? "d" : "a";
  const tp = shipPos(target, t);
  const dir = by === "a" ? 1 : -1;
  const from = { x: shooter.x + dir * 24, y: shooter.y - 14 };
  const to = hit
    ? { x: tp.x + (rnd(i, 1) - 0.5) * 14, y: tp.y - 10 - rnd(i, 2) * 6 }
    : { x: tp.x + dir * (rnd(i, 3) > 0.5 ? 36 : -38), y: SEA_Y + 2 };
  return { from, to, target };
}

function drawProjectile(ctx: CanvasRenderingContext2D, weapon: string | null, from: Pt, to: Pt, k: number, i: number, dir: number, spiralTo: Pt | null) {
  const arc = weapon === "missile" || weapon === "hyunmoo" ? 12 : weapon === "sling" ? 16 : 22;
  const pos = (q: number): Pt => {
    const qq = Math.max(0, Math.min(1, q));
    let x = from.x + (to.x - from.x) * qq;
    let y = from.y + (to.y - from.y) * qq - Math.sin(Math.PI * qq) * arc;
    // 블랙홀: 마지막 30%는 소용돌이로 빨려 들어감
    if (spiralTo && qq > 0.7) {
      const s = (qq - 0.7) / 0.3;
      const ang = s * Math.PI * 4;
      const r = (1 - s) * 11;
      x = spiralTo.x + Math.cos(ang) * r;
      y = spiralTo.y + Math.sin(ang) * r;
    }
    return { x: Math.round(x), y: Math.round(y) };
  };
  const p = pos(k);
  if (weapon === "missile" || weapon === "hyunmoo") {
    const big = weapon === "hyunmoo";
    // 연기 꼬리 (+ 현무는 불꽃)
    for (let j = 1; j <= 8; j++) {
      const q = pos(k - j * 0.025);
      ctx.fillStyle = j < 3 && big ? (j === 1 ? "#fde047" : "#f97316") : j % 2 ? "#cbd5e1" : "#94a3b8";
      const s = big ? 2 : 1;
      ctx.fillRect(q.x - dir * 0 + Math.round(rnd(i, j) * 2 - 1), q.y + Math.round(rnd(i, j + 9) * 2 - 1), s + (j > 5 ? 1 : 0), s);
    }
    const len = big ? 7 : 5;
    const h = big ? 3 : 2;
    const x0 = dir > 0 ? p.x - len : p.x;
    ctx.fillStyle = big ? "#475569" : "#f4f1e8";
    ctx.fillRect(x0, p.y - (h >> 1), len, h);
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(dir > 0 ? p.x : p.x - 1, p.y - (h >> 1), 1, h);
    return;
  }
  const ball = (q: Pt, size: number, color: string) => {
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(q.x - 1, q.y - 1, size + 1, size + 1);
    ctx.fillStyle = color;
    ctx.fillRect(q.x - 1, q.y - 1, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(q.x - 1, q.y - 1, 1, 1);
  };
  if (weapon === "sling") ball(p, 2, "#9ca3af");
  else if (weapon === "twin") {
    ball(p, 3, "#334155");
    ball(pos(k - 0.07), 3, "#334155");
  } else ball(p, 3, "#334155");
}

/** 입자 폭발 (seed i로 모양 고정) */
function burst(ctx: CanvasRenderingContext2D, at: Pt, age: number, i: number, n: number, power: number, palette: string[], gravity = 0) {
  for (let k = 0; k < n; k++) {
    const ang = rnd(i, k) * Math.PI * 2;
    const sp = (0.4 + rnd(i, k + 50)) * power;
    const x = at.x + Math.cos(ang) * sp * age;
    const y = at.y + Math.sin(ang) * sp * age * 0.8 + gravity * age * age;
    const ci = Math.min(palette.length - 1, Math.floor(age * palette.length + rnd(i, k + 99) * 0.8));
    ctx.fillStyle = palette[ci];
    const s = age < 0.4 && k % 3 === 0 ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
}

export type SceneState = { t: number; log: BattleLog };

/** 시각 t(ms, 전투 시작 기준)의 장면을 그린다 */
export function drawBattle(ctx: CanvasRenderingContext2D, t: number, log: BattleLog) {
  const shots = log.shots;
  const end = endTime(log);
  const ended = t >= end;
  const sinkAge = ended ? Math.min(1, (t - end) / T.sink) : 0;
  const loser: "a" | "d" = log.attackerWon ? "d" : "a";

  // 지금 진행 중인 포격
  const idx = t < T.intro ? -1 : Math.floor((t - T.intro) / T.shot);
  const cur = idx >= 0 && idx < shots.length ? shots[idx] : null;
  const k = cur ? (t - shotTime(idx)) / T.shot : 0;
  const impact = cur ? (k - T.flight) / (1 - T.flight) : -1;
  const weaponOf = (by: "a" | "d") => (log.gear ? log.gear[by].weapon : "cannon");
  const armorOf = (side: "a" | "d") => (log.gear ? log.gear[side].armor : null);

  ctx.save();
  // 치명타·현무 명중 순간 화면 흔들림
  if (cur && cur.hit && impact >= 0 && impact < 0.35 && (cur.crit || weaponOf(cur.by) === "hyunmoo")) {
    ctx.translate(Math.floor(t / 30) % 2 ? 2 : -2, Math.floor(t / 45) % 2 ? 1 : -1);
  }
  ctx.imageSmoothingEnabled = false;
  drawSky(ctx, t);

  for (const side of ["a", "d"] as const) {
    const tier = side === "a" ? log.a.shipTier : log.d.shipTier;
    const shaking = !!cur && cur.hit && impact >= 0 && impact < 0.4 && (cur.by === "a" ? "d" : "a") === side;
    drawShip(ctx, tier, side, t, {
      shake: shaking,
      sink: side === loser ? sinkAge : 0,
      winner: side !== loser,
      ended,
    });
  }
  drawSea(ctx, t);

  // 가라앉은 자리엔 해골 깃발만 둥둥
  if (sinkAge >= 1) {
    const p = shipPos(loser, t);
    const bob = Math.round(Math.sin(t * 0.004) * 1.5);
    const fx = Math.round(p.x);
    const fy = Math.round(p.y) - 9 + bob;
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(fx, fy, 1, 11);
    ctx.fillStyle = "#1a1d2b";
    ctx.fillRect(fx + 1, fy, 7, 5);
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(fx + 3, fy + 1, 3, 2);
    ctx.fillRect(fx + 4, fy + 3, 1, 1);
  }

  if (cur) {
    const dir = cur.by === "a" ? 1 : -1;
    const g = shotGeo(cur.by, cur.hit, idx, shotTime(idx));
    const weapon = weaponOf(cur.by);
    const tArmor = armorOf(g.target);
    const hole = cur.hit && tArmor === "blackhole";
    const holeAt = { x: g.to.x, y: g.to.y };
    // 포구 화염 + 연기
    if (k < 0.18) burst(ctx, g.from, k / 0.18, idx + 500, 7, 7, ["#ffffff", "#fde047", "#f97316", "#94a3b8"]);
    // 블랙홀 소용돌이
    if (hole && k > 0.3 && impact < 0.6) {
      const s = Math.min(1, (k - 0.3) / 0.2);
      for (let j = 0; j < 14; j++) {
        const ang = j * 0.9 + t * 0.012;
        const r = (3 + (j % 5) * 2.2) * s;
        ctx.fillStyle = j % 3 === 0 ? "#f4f1e8" : j % 2 ? "#a855f7" : "#4c1d95";
        ctx.fillRect(Math.round(holeAt.x + Math.cos(ang) * r), Math.round(holeAt.y + Math.sin(ang) * r * 0.7), 1, 1);
      }
      ctx.fillStyle = "#0b0614";
      ctx.fillRect(holeAt.x - 1, holeAt.y - 1, 3, 2);
    }
    if (k < T.flight) {
      drawProjectile(ctx, weapon, g.from, g.to, k / T.flight, idx, dir, hole ? holeAt : null);
    } else if (cur.hit) {
      const big = weapon === "hyunmoo";
      if (hole) {
        burst(ctx, holeAt, impact, idx, 10, 8, ["#f4f1e8", "#a855f7", "#4c1d95"]);
      } else {
        // 아이언돔: 맞는 순간 방어막이 번쩍
        if (tArmor === "irondome" && impact < 0.5 && Math.floor(t / 60) % 2 === 0) {
          const c = shipPos(g.target, t);
          ctx.fillStyle = "#7dd3fc";
          for (let a = 0; a <= Math.PI; a += 0.12) ctx.fillRect(Math.round(c.x + Math.cos(a) * 18), Math.round(c.y - 6 - Math.sin(a) * 16), 1, 1);
        }
        if (impact < 0.25) {
          const r = Math.round((big ? 12 : cur.crit ? 9 : 6) * (1 - impact * 2));
          // 십자 섬광 + 노란 심
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(g.to.x - r, g.to.y - 1, r * 2, 3);
          ctx.fillRect(g.to.x - 1, g.to.y - r, 3, r * 2);
          ctx.fillRect(g.to.x - (r >> 1), g.to.y - (r >> 1), r, r);
          ctx.fillStyle = "#fde047";
          ctx.fillRect(g.to.x - (r >> 2), g.to.y - (r >> 2), (r >> 1) + 1, (r >> 1) + 1);
        }
        burst(ctx, g.to, impact, idx, big ? 34 : cur.crit ? 24 : 15, big ? 30 : cur.crit ? 22 : 15, ["#ffffff", "#fde047", "#f97316", "#dc2626", "#475569", "#94a3b8"], -6);
        if (big) burst(ctx, g.to, impact, idx + 77, 16, 18, ["#fde047", "#f97316", "#dc2626", "#1a1d2b"], 10);
      }
      text(ctx, `-${cur.dmg}${cur.crit ? "!" : ""}`, g.to.x, g.to.y - 14 - impact * 10, cur.crit ? "#fde047" : "#ffffff", cur.crit || big ? 2 : 1);
    } else {
      // 빗나감: 물보라
      burst(ctx, { x: g.to.x, y: g.to.y }, impact, idx, 14, 9, ["#ffffff", "#cfe8f7", "#7dd3fc", "#3c84c4"], 26);
      if (impact < 0.6) {
        ctx.fillStyle = "#ffffff";
        const r = Math.round(4 + impact * 10);
        ctx.fillRect(g.to.x - r, g.to.y + 1, 2, 1);
        ctx.fillRect(g.to.x + r - 2, g.to.y + 1, 2, 1);
      }
      text(ctx, "MISS", g.to.x, g.to.y - 16 - impact * 6, "#cfe8f7");
    }
  }

  // 시작 전 "준비" 깜빡임 없이 바로 시작. 끝나면 이긴 쪽 위에 별 반짝
  if (ended && sinkAge > 0.5) {
    const wp = shipPos(loser === "a" ? "d" : "a", t);
    for (let j = 0; j < 6; j++) {
      if ((Math.floor(t / 150) + j) % 3 === 0) continue;
      ctx.fillStyle = j % 2 ? "#fde047" : "#ffffff";
      ctx.fillRect(Math.round(wp.x - 18 + j * 7), Math.round(wp.y - 34 - ((j * 5) % 7)), 1, 1);
    }
  }
  ctx.restore();
}
