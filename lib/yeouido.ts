/**
 * 여의도 해도(海圖): 섬을 약 250m 격자로 나누고, 정박지가 발견된 칸을 "밝혀진 해역"으로 본다.
 * 섬 경계는 대략적인 다각형이다. 실제와 다르면 YEOUIDO_POLYGON 꼭짓점만 고치면 된다.
 */
export type Cell = { id: string; south: number; west: number; north: number; east: number };

// [위도, 경도] 시계 방향. 서쪽 끝(국회 서편) → 북쪽 한강변 → 동쪽 끝(63빌딩) → 남쪽 샛강변
export const YEOUIDO_POLYGON: [number, number][] = [
  [37.5338, 126.91],
  [37.5368, 126.917],
  [37.5352, 126.926],
  [37.532, 126.934],
  [37.527, 126.941],
  [37.5215, 126.9455],
  [37.518, 126.94],
  [37.5165, 126.93],
  [37.518, 126.92],
  [37.5235, 126.912],
  [37.529, 126.909],
];

const LAT_STEP = 0.00225; // 약 250m
const LNG_STEP = 0.0028; // 위도 37.5°에서 약 250m

const bounds = YEOUIDO_POLYGON.reduce(
  (b, [lat, lng]) => ({
    s: Math.min(b.s, lat),
    n: Math.max(b.n, lat),
    w: Math.min(b.w, lng),
    e: Math.max(b.e, lng),
  }),
  { s: 90, n: -90, w: 180, e: -180 },
);

function inPolygon(lat: number, lng: number): boolean {
  let inside = false;
  const p = YEOUIDO_POLYGON;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [yi, xi] = p[i];
    const [yj, xj] = p[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

/** 섬에 걸친 칸 목록 (칸 중심 또는 꼭짓점 중 하나라도 섬 안이면 포함) */
export const YEOUIDO_CELLS: Cell[] = (() => {
  const cells: Cell[] = [];
  const rows = Math.ceil((bounds.n - bounds.s) / LAT_STEP);
  const cols = Math.ceil((bounds.e - bounds.w) / LNG_STEP);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const south = bounds.s + r * LAT_STEP;
      const west = bounds.w + c * LNG_STEP;
      const north = south + LAT_STEP;
      const east = west + LNG_STEP;
      const probes: [number, number][] = [
        [(south + north) / 2, (west + east) / 2],
        [south, west],
        [south, east],
        [north, west],
        [north, east],
      ];
      const hits = probes.filter(([la, ln]) => inPolygon(la, ln)).length;
      // 중심이 섬 안이거나 꼭짓점 2개 이상이 섬 안인 칸만 (물 위 칸 제외)
      if (inPolygon(probes[0][0], probes[0][1]) || hits >= 3) {
        cells.push({ id: cellKey(r, c), south, west, north, east });
      }
    }
  }
  return cells;
})();

const CELL_IDS = new Set(YEOUIDO_CELLS.map((c) => c.id));

/** 좌표가 속한 해역 칸 id (여의도 밖이면 null) */
export function cellOf(lat: number, lng: number): string | null {
  const r = Math.floor((lat - bounds.s) / LAT_STEP);
  const c = Math.floor((lng - bounds.w) / LNG_STEP);
  const id = cellKey(r, c);
  return CELL_IDS.has(id) ? id : null;
}

export function exploredCells(spots: { lat: number; lng: number }[]): Set<string> {
  const set = new Set<string>();
  for (const s of spots) {
    const id = cellOf(s.lat, s.lng);
    if (id) set.add(id);
  }
  return set;
}
