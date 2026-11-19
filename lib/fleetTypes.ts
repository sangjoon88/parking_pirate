/** 해적단 화면에 내려보내는 모양 (서버·클라이언트 공용) */
import type { CrewStats, Loadout, Shot } from "./naval";

export type CrewView = {
  userId: string;
  name: string;
  nickname: string;
  flag: string;
  nameColor: string | null;
  nameEffect: string | null;
  shipTier: number;
  hp: number;
  stats: CrewStats;
  loadout: Loadout;
  wins: number;
  losses: number;
  title: string;
  overlord: { userId: string; name: string; until: string; rate: number; paid: number } | null;
  vassals: { userId: string; name: string; until: string }[];
  protectedUntil: string | null;
};

export type RivalView = {
  userId: string;
  name: string;
  nickname: string;
  flag: string;
  nameColor: string | null;
  nameEffect: string | null;
  shipTier: number;
  power: number;
  hpPct: number;
  wins: number;
  losses: number;
  title: string;
  overlordName: string | null;
  protectedUntil: string | null;
  attack: { ok: boolean; independence: boolean; reason: string };
};

export type BattleSide = { userId: string; name: string; flag: string; shipTier: number; maxHp: number; hp0: number; power: number };

export type BattleLog = {
  a: BattleSide;
  d: BattleSide;
  shots: Shot[];
  attackerWon: boolean;
  independence: boolean;
  terms: "bully" | "even" | "underdog";
  tributeRate: number;
  loot: number; // 이긴 공격 쪽 전리품
  defense: number; // 지킨 쪽 보상
  refund: number; // 독립 성공 시 돌려받은 상납금
  brokenA: { id: string; count: number }[];
  brokenD: { id: string; count: number }[];
  /** 연출용: 양쪽의 가장 강한 무기·방어구 (예전 기록엔 없음) */
  gear?: { a: Gear; d: Gear };
};

export type Gear = { weapon: string | null; armor: string | null };

export type BattleView = { id: string; createdAt: string; log: BattleLog };

export type FleetState = {
  me: { id: string; balance: number };
  crew: CrewView | null;
  rivals: RivalView[];
  battles: BattleView[];
  raidsLeft: number;
};
