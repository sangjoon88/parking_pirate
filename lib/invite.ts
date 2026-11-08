import { randomInt } from "node:crypto";

// 헷갈리는 글자(0/O, 1/I/L) 제외
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateInviteCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** 사용자가 입력한 코드를 저장 형식(XXXX-XXXX)으로 정리 */
export function normalizeInviteCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (raw.length !== 8) return input.trim().toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
