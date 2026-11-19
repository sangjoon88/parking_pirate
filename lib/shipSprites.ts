import { spriteSvg } from "./pixelSprites";

/** 배 단계별 도트 그림 (20x12, 오른쪽을 바라봄) */
export const SHIP_ROWS: string[][] = [
  // 0 돛단배
  [
    "........M...........",
    "........MS..........",
    "........MSS.........",
    "........MSSS........",
    "........MSSSS.......",
    "........MSSSSS......",
    "........MSSSSSS.....",
    "........M...........",
    "....XXXXXXXXXXXX....",
    ".....HHHHHHHHHH.....",
    "......hhhhhhhh......",
    "....................",
  ],
  // 1 통통배
  [
    "...........YY.......",
    "..........YY........",
    "...........gg.......",
    "...........gg.......",
    "......CCCCCgg.......",
    "......CWCWCgg.......",
    "......CCCCCCC.......",
    "..XXXXXXXXXXXXXXXX..",
    "...HHHHHHHHHHHHHH...",
    "....RRRRRRRRRRRR....",
    ".....hhhhhhhhhh.....",
    "....................",
  ],
  // 2 유람선
  [
    "..........F.........",
    "..........M.........",
    ".......CCCCCCC......",
    ".......CWCWCWC......",
    "....CCCCCCCCCCCC....",
    "....CWCWCWCWCWCC....",
    "....CCCCCCCCCCCC....",
    ".XXXXXXXXXXXXXXXXXX.",
    "..CCCCCCCCCCCCCCCC..",
    "...BBBBBBBBBBBBBB...",
    "....BBBBBBBBBBBB....",
    "....................",
  ],
  // 3 해적 갤리온
  [
    ".....F........F.....",
    ".....M........M.....",
    "...KKKKK....KKKKK...",
    "...KKWKK....KKWKK...",
    "...KKKKK....KKKKK...",
    "....KKK......KKK....",
    ".....M........M.....",
    "XX...M........M...XX",
    "XHHHHHHHHHHHHHHHHHHX",
    ".HhWhhWhhWhhWhhWhhH.",
    "..HHHHHHHHHHHHHHHH..",
    "....................",
  ],
  // 4 철갑 함선
  [
    ".........F..........",
    ".........M..........",
    "........GGG.........",
    ".......GGWGG........",
    "ggggggGGGGGGG.......",
    "......GGGGGGGGGgggg.",
    "....GGGGGGGGGGGGG...",
    ".XXXXXXXXXXXXXXXXXX.",
    "..GGGGGGGGGGGGGGGGG.",
    "...gggggggggggggggg.",
    "....RRRRRRRRRRRRRR..",
    "....................",
  ],
  // 5 유령선
  [
    ".....E........E.....",
    ".....e........e.....",
    "...EEEE.E...EE.EE...",
    "...E.EEEE...EEEEE...",
    "...EEE.EE...E.EEE...",
    "....EE.E.....EEE....",
    ".....e........e.....",
    "ee...e........e...ee",
    "eEEEEEEEEEEEEEEEEEEe",
    ".EeEeeEeeEeeEeeEeeE.",
    "..eEEEEEEEEEEEEEEe..",
    "....................",
  ],
];

export const SHIP_PALETTE: Record<string, string> = {
  X: "#2b1d0e",
  H: "#8a5a2b",
  h: "#5e3b1a",
  M: "#6b4423",
  S: "#f4f1e8",
  K: "#1a1d2b",
  W: "#f5c451",
  F: "#dc2626",
  C: "#e2e8f0",
  R: "#b91c1c",
  B: "#1e3a8a",
  G: "#94a3b8",
  g: "#475569",
  Y: "#cbd5e1",
  E: "#86efac",
  e: "#15803d",
};

export function shipSvg(tier: number, scale: number, flip = false): string {
  const rows = SHIP_ROWS[Math.max(0, Math.min(SHIP_ROWS.length - 1, tier))];
  return spriteSvg(rows, SHIP_PALETTE, scale, `${flip ? "transform:scaleX(-1);" : ""}${tier === 5 ? "opacity:.85;" : ""}`);
}
