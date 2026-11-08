export const SESSION_COOKIE = "pp_session";
export const SESSION_DAYS = 30;
export const PARKING_MAX_HOURS = 12;
export const INVITE_DAYS = 7;
export const MAX_OPEN_INVITES = 2;
export const GUARD_AVG_DAYS = 14;
export const GATE_CLOSE_THRESHOLD = 2;
export const NOTE_MAX = 200;
export const STALE_DAYS = 7;

export function maxMembers(): number {
  const n = Number(process.env.MAX_MEMBERS ?? 20);
  return Number.isFinite(n) && n > 0 ? n : 20;
}
