/**
 * 픽셀 아트 해적기. 문자 격자를 SVG 사각형으로 그린다 (이미지 파일 없음, 어떤 크기에서도 또렷함).
 * 깃발은 세로줄마다 1픽셀씩 계단식으로 오르내려 펄럭이는 것처럼 보인다.
 */

import { COLORS, FLAG } from "@/lib/pixelArt";


const W = 40;
const H = 34;
const FLAG_X = 5; // 깃대(x=3~4) 바로 옆
const FLAG_Y = 4;

type Px = { x: number; y: number; c: string };

/** 깃발 바깥 고정 요소: 깃대, 금장식, 별, 파도 */
function scenery(): Px[] {
  const px: Px[] = [];
  // 별
  for (const [x, y] of [
    [33, 2],
    [37, 6],
    [2, 10],
    [36, 14],
    [30, 1],
  ]) {
    px.push({ x, y, c: "T" });
  }
  // 깃대 꼭대기 금장식
  for (const [x, y] of [
    [3, 0],
    [4, 0],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [3, 2],
    [4, 2],
  ]) {
    px.push({ x, y, c: "Y" });
  }
  // 깃대
  for (let y = 3; y < 29; y++) {
    px.push({ x: 3, y, c: "P" }, { x: 4, y, c: "p" });
  }
  // 파도 (3줄)
  const waveTop = "..LL....LL....LL....LL....LL....LL....LL";
  const waveMid = "LLFFLLLLLLFFLLLLLLFFLLLLLLFFLLLLLLFFLLLLLL";
  for (let x = 0; x < W; x++) {
    if (waveTop[x] === "L") px.push({ x, y: 28, c: "L" });
    px.push({ x, y: 29, c: waveMid[x] === "F" ? "F" : "L" });
    for (let y = 30; y < H; y++) px.push({ x, y, c: (x + y) % 7 === 0 ? "L" : "B" });
  }
  return px;
}

const SCENERY = scenery();

export default function PixelFlag({ className, animate = true }: { className?: string; animate?: boolean }) {
  const cols = FLAG[0].length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="픽셀 해적기"
    >
      {SCENERY.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={1.04} height={1.04} fill={COLORS[p.c]} />
      ))}
      {Array.from({ length: cols }, (_, x) => (
        <g
          key={x}
          className={animate ? "pp-flag-col" : undefined}
          // 4줄씩 묶어 움직여 해골 모양이 덜 깨지게, 깃대에서 멀수록 늦게 (물결)
          style={animate ? { animationDelay: `${-Math.floor(x / 4) * 0.16}s` } : undefined}
        >
          {FLAG.map((row, y) => {
            const ch = row[x];
            // 짝수 4칸 묶음마다 살짝 어두운 줄을 넣어 천의 접힘 표현
            const color = ch === "K" && Math.floor(x / 4) % 2 === 1 ? COLORS.S : COLORS[ch];
            return <rect key={y} x={FLAG_X + x} y={FLAG_Y + y} width={1.04} height={1.04} fill={color} />;
          })}
        </g>
      ))}
    </svg>
  );
}
