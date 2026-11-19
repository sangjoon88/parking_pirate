/** 새 소식을 마지막으로 본 시각 (이 기기에만 저장. 못 읽어도 동작에 문제없음) */
const KEY = "pp_feed_seen";
export const FEED_SEEN_EVENT = "pp-feed-seen";

export function getFeedSeen(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setFeedSeen(iso: string) {
  try {
    localStorage.setItem(KEY, iso);
  } catch {
    /* 저장 못 해도 괜찮다 */
  }
  window.dispatchEvent(new Event(FEED_SEEN_EVENT));
}
