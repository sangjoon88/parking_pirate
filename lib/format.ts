export function timeAgo(iso: string | Date | null): string {
  if (!iso) return "기록 없음";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

export function duration(fromIso: string | Date, to: Date = new Date()): string {
  const m = Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}시간 ${m % 60}분` : `${m}분`;
}

export function dateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const GUARD_LABELS: Record<number, string> = {
  1: "무관심",
  2: "느슨함",
  3: "보통",
  4: "엄격함",
  5: "매우 엄격",
};

/** 경계 레벨 → 핀 색 (낮음 초록 → 높음 빨강) */
export function guardColor(avg: number | null, closed: boolean): string {
  if (closed) return "#6b7280";
  if (avg == null) return "#3b82f6";
  if (avg < 1.8) return "#16a34a";
  if (avg < 2.6) return "#84cc16";
  if (avg < 3.4) return "#eab308";
  if (avg < 4.2) return "#f97316";
  return "#dc2626";
}

export function guardText(avg: number | null): string {
  if (avg == null) return "정보 없음";
  return `${avg.toFixed(1)} · ${GUARD_LABELS[Math.round(avg)]}`;
}
