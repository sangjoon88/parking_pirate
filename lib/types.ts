export type SpotSummary = {
  id: string;
  name: string;
  /** 전설의 정박지 별명 */
  nickname: string | null;
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
  totalParkings: number;
  /** 누적 정박 100회 이상 */
  legendary: boolean;
  guardAvg: number | null;
  /** 받을 수 있는 현상금 합계(두블룬). 0이면 없음 */
  bounty: number;
  /** 그중 선원이 건 몫 */
  postedBounty: number;
  /** 정박지 소개 (누구나 고침) */
  description: string | null;
  descriptionBy: string | null;
  descriptionAt: string | null;
  /** 최근 30분 안의 경계 레벨 5 제보 */
  navyAlert: { at: string; by: string } | null;
  /** 영주 (최근 30일 최다 정박) */
  lord: { userId: string; nickname: string; flag: string; count: number } | null;
  /** 해적왕의 영지: 지난달 해적왕이 지금 이곳의 영주 (이번 달 내내 표시) */
  kingDomain: { nickname: string } | null;
  /** 오늘의 보물상자 금액 (없으면 0) */
  treasure: number;
  /** 누군가 묻은 보물이 있다는 소문 */
  stashRumor: boolean;
};

export type SpotReport = {
  id: string;
  guardLevel: number | null;
  gateStatus: "no_gate" | "gate_installed" | null;
  note: string;
  createdAt: string;
  updatedAt: string | null;
  nickname: string;
  photoId: string | null;
  /** 내가 쓴 일지면 고칠 수 있음 */
  mine: boolean;
  /** 쓴 선원 또는 관리자면 지울 수 있음 */
  canDelete: boolean;
};

export type GuardContact = {
  id: string;
  label: string;
  digits: string;
  nickname: string;
  createdAt: string;
  canDelete: boolean;
};

export type SpotPhoto = {
  id: string;
  nickname: string;
  createdAt: string;
  width: number | null;
  height: number | null;
  canDelete: boolean;
};

export type ActiveParking = {
  id: string;
  spotId: string;
  spotName: string;
  startedAt: string;
  navyAlert: { at: string; by: string } | null;
} | null;

export type RadioMessage = { id: string; lat: number; lng: number; text: string; createdAt: string; nickname: string; mine: boolean };

export type Wonder = { id: string; lat: number; lng: number; note: string; createdAt: string; nickname: string; mine: boolean };

export type WeatherId = "calm" | "storm" | "fog" | "tailwind";

/** 새 소식 한 줄: 정박지 발견, 항해 일지, 해전 */
export type FeedItem = {
  kind: "spot" | "report" | "battle";
  id: string;
  spotId: string | null;
  spotName: string | null;
  nickname: string;
  nameColor: string | null;
  nameEffect: string | null;
  createdAt: string;
  guardLevel: number | null;
  gateStatus: "no_gate" | "gate_installed" | null;
  note: string | null;
  photoId: string | null;
  battle: { attacker: string; defender: string; defenderNick: string; attackerWon: boolean; independence: boolean } | null;
};
