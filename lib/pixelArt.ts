/** 픽셀 해적기 그림 데이터 (스플래시와 앱 아이콘이 같이 쓴다) */

// 깃발 28x18: K 바탕, W 해골, G 뼈
export const FLAG = [
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  "KKKKKKKKKKKWWWWWWKKKKKKKKKKK",
  "KKKKKKKKKWWWWWWWWWWKKKKKKKKK",
  "KKKKKKKKWWWWWWWWWWWWKKKKKKKK",
  "KKKKKKKKWWWWWWWWWWWWKKKKKKKK",
  "KKKKKKKKWWKKWWWWKKWWKKKKKKKK",
  "KKKKKKKKWKKKKWWKKKKWKKKKKKKK",
  "KKKKKKKKWWKKWWWWKKWWKKKKKKKK",
  "KKKKKKKKKWWWWKKWWWWKKKKKKKKK",
  "KKKKKKKKKKWWWWWWWWKKKKKKKKKK",
  "KKKKGGKKKKKWKWWKWKKKKKGGKKKK",
  "KKKKGGGGKKKKKKKKKKKKGGGGKKKK",
  "KKKKKKKKGGGKKKKKKGGGKKKKKKKK",
  "KKKKKKKKKKKGGGGGGKKKKKKKKKKK",
  "KKKKKKKKKKKGGGGGGKKKKKKKKKKK",
  "KKKKKKKKGGGKKKKKKGGGKKKKKKKK",
  "KKKKGGGGKKKKKKKKKKKKGGGGKKKK",
  "KKKKGGKKKKKKKKKKKKKKKKGGKKKK",
];

export const COLORS: Record<string, string> = {
  K: "#23273a", // 깃발 검정 (배경보다 밝게)
  S: "#2e3349", // 깃발 접힌 면
  W: "#f4f1e8", // 해골
  G: "#d9d2bf", // 뼈
  P: "#8a5a2b", // 깃대
  p: "#5e3b1a", // 깃대 그림자
  Y: "#f5c451", // 금장식
  B: "#1c3656", // 파도 짙은
  L: "#2a5a8c", // 파도
  F: "#cfe3f5", // 물거품
  T: "#f5c451", // 별
};

/**
 * 앱 아이콘용 정사각형 SVG (36x36 격자): 깃대 + 깃발 + 파도. 움직임 없음.
 * maskable이면 Android가 원형으로 잘라도 그림이 남도록 가장자리 여백을 둔다.
 */
export function iconSvg(size: number, { maskable = false, rounded = true } = {}): string {
  const N = 36;
  const rects: string[] = [];
  const px = (x: number, y: number, c: string) =>
    rects.push(`<rect x="${x}" y="${y}" width="1.04" height="1.04" fill="${c}"/>`);
  // 금장식 + 깃대
  for (const [x, y] of [[3, 3], [4, 3], [2, 4], [3, 4], [4, 4], [5, 4], [3, 5], [4, 5]]) px(x, y, COLORS.Y);
  for (let y = 6; y < 30; y++) {
    px(3, y, COLORS.P);
    px(4, y, COLORS.p);
  }
  // 깃발
  FLAG.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = ch === "K" && Math.floor(x / 4) % 2 === 1 ? COLORS.S : COLORS[ch];
      px(5 + x, 8 + y, c);
    }),
  );
  // 파도
  for (let x = 0; x < N; x++) {
    if (x % 6 < 2) px(x, 29, COLORS.L);
    px(x, 30, x % 8 === 2 ? COLORS.F : COLORS.L);
    for (let y = 31; y < N; y++) px(x, y, (x + y) % 7 === 0 ? COLORS.L : COLORS.B);
  }
  const pad = maskable ? 4 : 0; // 안전 영역
  const vb = `${-pad} ${-pad} ${N + pad * 2} ${N + pad * 2}`;
  const r = rounded && !maskable ? (N + pad * 2) * 0.2 : 0;
  const bg = `<rect x="${-pad}" y="${-pad}" width="${N + pad * 2}" height="${N + pad * 2}" rx="${r}"/>`;
  // 둥근 모서리 밖으로 파도가 삐져나오지 않게 같은 모양으로 잘라 낸다
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}" shape-rendering="crispEdges"><defs><clipPath id="c">${bg}</clipPath></defs><g clip-path="url(#c)"><rect x="${-pad}" y="${-pad}" width="${N + pad * 2}" height="${N + pad * 2}" fill="#07111f"/>${rects.join("")}</g></svg>`;
}
