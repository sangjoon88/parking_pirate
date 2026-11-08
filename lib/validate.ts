export function validNickname(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < 2 || s.length > 12) return null;
  if (!/^[0-9A-Za-z가-힣_]+$/.test(s)) return null;
  return s;
}

export function validPassword(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (v.length < 6 || v.length > 72) return null;
  return v;
}
