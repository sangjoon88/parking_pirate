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
  parkedCount: number;
  guardAvg: number | null;
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
} | null;
