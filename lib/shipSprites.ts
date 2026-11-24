import { spriteSvg } from "./pixelSprites";

/** 배 단계별 도트 그림 (20x12, 오른쪽을 바라봄) */
export const SHIP_ROWS: string[][] = [
  // 0 돛단배: 삼각 돛에 그늘, 깃발 하나
  [
    "........MF..........",
    "........MS..........",
    "........MSS.........",
    "........MSSs........",
    "........MSSSs.......",
    "........MSSSSs......",
    "........MSSSSSs.....",
    "........M...........",
    "...XXXXXXXXXXXXXX...",
    "....HLHHHHHHHHHH....",
    ".....hhhhhhhhhh.....",
    "....................",
  ],
  // 1 통통배: 굴뚝 연기, 둥근 창
  [
    "............ww......",
    "...........ww.......",
    "...........gg.......",
    "...........RR.......",
    "......CCCCCgg.......",
    "......CVCVCgg.......",
    ".....XCCCCCCCX......",
    "..XXXXXXXXXXXXXXXX..",
    "...HLHHHHHHHHHHHH...",
    "....RRRRRRRRRRRR....",
    ".....hhhhhhhhhh.....",
    "....................",
  ],
  // 2 유람선: 이층 갑판, 빨간 굴뚝
  [
    "...........RR.......",
    "...........RR.......",
    "...........gg.......",
    "........CCCCCC......",
    "........CVCVCC......",
    ".....CCCCCCCCCCC....",
    ".....CVCVCVCVCVC....",
    ".XXXXXXXXXXXXXXXXXX.",
    "..CCCCCCCCCCCCCCCC..",
    "..BBBBBBBBBBBBBBBB..",
    "...bbbbbbbbbbbbbb...",
    "....................",
  ],
  // 3 해적 갤리온: 검은 돛 두 장에 뼈 무늬, 금빛 포문
  [
    ".....F........F.....",
    ".....M........M.....",
    "...KKKKK....KKKKK...",
    "..KKKWKKK..KKKWKKK..",
    "..KKWKWKK..KKWKWKK..",
    "...KKKKK....KKKKK...",
    ".....M........M.....",
    "XX...M........M..XXX",
    "XHLHHHHHHHHHHHHHHHHX",
    ".HWhhWhhWhhWhhWhhWH.",
    "..hhhhhhhhhhhhhhhh..",
    "....................",
  ],
  // 4 철갑 함선: 포탑과 리벳 창
  [
    ".........F..........",
    ".........M..........",
    "........GGG.........",
    ".......GGVGG........",
    "ggggggGGGGGGG.......",
    "......GGGGGGGGGgggg.",
    "....GGwGGwGGwGGGG...",
    ".XXXXXXXXXXXXXXXXXX.",
    "..GGGGGGGGGGGGGGGGG.",
    "...gggggggggggggggg.",
    "....RRRRRRRRRRRRRR..",
    "....................",
  ],
  // 5 유령선: 찢긴 돛, 초록 빛
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
  X: "#2b1d0e", // 뱃전 테두리
  H: "#8a5a2b", // 선체
  L: "#b9844a", // 선체 빛
  h: "#5e3b1a", // 선체 그늘
  M: "#6b4423", // 돛대
  S: "#f4f1e8", // 돛
  s: "#cfc6ad", // 돛 그늘
  K: "#1a1d2b", // 검은 돛
  W: "#f5c451", // 금빛
  F: "#dc2626", // 깃발
  C: "#e2e8f0", // 흰 선실
  V: "#38bdf8", // 창
  R: "#b91c1c", // 빨강
  B: "#1e3a8a", // 남색 선체
  b: "#172554", // 남색 그늘
  G: "#94a3b8", // 강철
  g: "#475569", // 강철 그늘
  w: "#cbd5e1", // 연기
  Y: "#cbd5e1",
  E: "#86efac", // 유령 빛
  e: "#15803d",
};

export function shipSvg(tier: number, scale: number, flip = false): string {
  const rows = SHIP_ROWS[Math.max(0, Math.min(SHIP_ROWS.length - 1, tier))];
  return spriteSvg(rows, SHIP_PALETTE, scale, `${flip ? "transform:scaleX(-1);" : ""}${tier === 5 ? "opacity:.85;" : ""}`);
}
