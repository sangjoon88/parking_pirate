export type SpotSummary = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  status: "open" | "closed";
  lastConfirmedAt: string | null;
  createdAt: string;
  discoverer: string;
  /** 발견자가 이달의 해적왕인지 */
  discovererIsKing: boolean;
  parkedCount: number;
  guardAvg: number | null;
  /** 현상금(두블룬). 0이면 없음 */
  bounty: number;
  /** 최근 30분 안의 경계 레벨 5 제보 */
  navyAlert: { at: string; by: string } | null;
};

export type SpotReport = {
  id: string;
  guardLevel: number | null;
  gateStatus: "no_gate" | "gate_installed" | null;
  note: string;
  createdAt: string;
  nickname: string;
};

export type ActiveParking = {
  id: string;
  spotId: string;
  spotName: string;
  startedAt: string;
  navyAlert: { at: string; by: string } | null;
} | null;
