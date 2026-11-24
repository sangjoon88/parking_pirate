/**
 * 지도용 도트 스프라이트. 문자 격자 → SVG 문자열 (이미지 파일 없음, 어떤 배율에서도 또렷함).
 * '.'은 투명, 나머지 글자는 팔레트 색.
 */

export type Palette = Record<string, string>;

export function spriteSvg(rows: string[], palette: Palette, scale: number, extraStyle = ""): string {
  const h = rows.length;
  const w = rows[0].length;
  const rects: string[] = [];
  rows.forEach((row, y) => {
    // 같은 색이 이어지면 한 사각형으로 합친다 (DOM 줄이기)
    let x = 0;
    while (x < w) {
      const ch = row[x];
      if (ch === "." || !palette[ch]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < w && row[x + run] === ch) run++;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${palette[ch]}"/>`);
      x += run;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" style="display:block;${extraStyle}">${rects.join("")}</svg>`;
}

/** 정박지 핀 몸통 (14x16). c = 경계 레벨 색, X = 테두리, H = 하이라이트 */
const PIN = [
  "....XXXXXX....",
  "..XXHHccccXX..",
  ".XHHccccccccX.",
  ".XHcccccccccX.",
  "XHcccccccccccX",
  "XccccccccccccX",
  "XccccccccccccX",
  "XccccccccccccX",
  "XccccccccccccX",
  ".XccccccccccX.",
  ".XccccccccccX.",
  "..XccccccccX..",
  "...XccccccX...",
  "....XccccX....",
  ".....XccX.....",
  "......XX......",
];

/** 핀 안에 들어가는 8x7 그림 */
const GLYPHS: Record<"skull" | "gate" | "ship", string[]> = {
  skull: [
    ".WWWWWW.",
    "WWWWWWWW",
    "WKKWWKKW",
    "WKKWWKKW",
    "WWWKKWWW",
    ".WWWWWW.",
    ".W.WW.W.",
  ],
  gate: [
    "........",
    "RRWWRRWW",
    "RRWWRRWW",
    ".K....K.",
    ".K....K.",
    ".K....K.",
    "KKK..KKK",
  ],
  ship: [
    "...W....",
    "...WW...",
    "...WWW..",
    "...WWWW.",
    "...K....",
    "BBBBBBBB",
    ".BBBBBB.",
  ],
};

export function pinSvg(opts: { color: string; outline: string; glyph: keyof typeof GLYPHS; scale: number }): string {
  const rows = PIN.map((r) => r.split(""));
  GLYPHS[opts.glyph].forEach((g, gy) =>
    [...g].forEach((ch, gx) => {
      if (ch !== ".") rows[3 + gy][3 + gx] = ch;
    }),
  );
  return spriteSvg(
    rows.map((r) => r.join("")),
    {
      X: opts.outline,
      c: opts.color,
      H: "rgba(255,255,255,.45)",
      W: "#f4f1e8",
      K: "#1a1d2b",
      R: "#dc2626",
      B: "#8a5a2b",
    },
    opts.scale,
  );
}

/** 오늘의 보물상자 (10x7) */
export function chestSvg(scale: number): string {
  return spriteSvg(
    [
      ".XXXXXXXX.",
      "XBBBBBBBBX",
      "XYYYYYYYYX",
      "XBBBYYBBBX",
      "XBBBYYBBBX",
      "XBBBBBBBBX",
      "XXXXXXXXXX",
    ],
    { X: "#1a1d2b", B: "#8a5a2b", Y: "#f5c451" },
    scale,
  );
}

/** 궁금한 곳 말풍선 (9x10) */
export function wonderSvg(scale: number, mine: boolean): string {
  return spriteSvg(
    [
      ".XXXXXXX.",
      "XPPPPPPPX",
      "XPPWWWPPX",
      "XPWPPPWPX",
      "XPPPPWPPX",
      "XPPPWPPPX",
      "XPPPPPPPX",
      "XPPPWPPPX",
      ".XXXXXXX.",
      "...XX....",
    ],
    { X: mine ? "#f5c451" : "#f4f1e8", P: "#7c3aed", W: "#fff" },
    scale,
  );
}

/** 나침반 장식 (11x11) */
export function compassSvg(scale: number): string {
  return spriteSvg(
    [
      ".....R.....",
      "....RRR....",
      "....RRR....",
      "...XRRRX...",
      "..X.YYY.X..",
      "WWWWYXYWWWW",
      "..X.YYY.X..",
      "...XWWWX...",
      "....WWW....",
      "....WWW....",
      ".....W.....",
    ],
    { R: "#dc2626", W: "#f4f1e8", Y: "#f5c451", X: "#8a5a2b" },
    scale,
  );
}

/** 한강 괴물 (24x10): 옛 해도 가장자리의 바다뱀 장식. 머리는 오른쪽 */
export function seaMonsterSvg(scale: number): string {
  return spriteSvg(
    [
      "..................KKK...",
      ".................KEEEK..",
      "................KEEWKEK.",
      "................KEEEEERR",
      "....KKK.....KKK.KEeEK...",
      "...KEEEK...KEEEKKEeK....",
      "..KEeeeEK.KEeeeEKEeK....",
      "..KEe.eEK.KEe.eEKEeK....",
      "CCBBBBBBBBBBBBBBBBBBBCC.",
      ".bbb..bbbbb..bbbbbb..b..",
    ],
    { K: "#2b1d0e", E: "#4d7c5a", e: "#2f5a3e", W: "#f5c451", R: "#dc2626", B: "#3b6e8f", b: "#2a5470", C: "#e2e8f0" },
    scale,
  );
}
