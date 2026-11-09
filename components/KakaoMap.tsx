"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { guardColor } from "@/lib/format";
import { loadKakao, type Kakao, type LatLng } from "@/lib/kakao";
import { STALE_DAYS } from "@/lib/constants";
import { FLEET_SIZE } from "@/lib/game";
import type { RadioMessage, SpotSummary, Wonder } from "@/lib/types";
import { YEOUIDO_CELLS } from "@/lib/yeouido";

export type KakaoMapHandle = {
  kakao: Kakao | null;
  panTo: (p: LatLng, level?: number) => void;
  getCenter: () => LatLng | null;
  setMyLocation: (p: LatLng | null) => void;
};

type Props = {
  ref?: Ref<KakaoMapHandle>;
  initialCenter: LatLng;
  initialLevel?: number;
  spots: SpotSummary[];
  selectedId: string | null;
  onSpotTap: (id: string) => void;
  onLongPress: (p: LatLng) => void;
  onReady?: (kakao: Kakao) => void;
  /** 해도 모드: 밝혀진 해역 칸 id 목록. null이면 해도를 그리지 않는다 */
  fogExplored?: Set<string> | null;
  /** 무전기 쪽지 */
  radios?: RadioMessage[];
  /** 궁금한 곳 ❓ */
  wonders?: Wonder[];
  onWonderTap?: (id: string) => void;
};

/** 무전 말풍선 (사용자 글은 textContent로 넣어 HTML 주입을 막는다) */
function radioEl(m: RadioMessage): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText =
    "transform:translateY(-100%);margin-top:-6px;max-width:180px;background:#fff;color:#07111f;border-radius:12px;padding:5px 9px;box-shadow:0 2px 8px rgba(0,0,0,.45);font:600 12px/1.35 sans-serif;position:relative";
  const who = document.createElement("div");
  who.style.cssText = "font-size:10px;color:#64748b;font-weight:700";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(m.createdAt).getTime()) / 60000));
  who.textContent = `📻 ${m.nickname} · ${mins < 1 ? "방금" : `${mins}분 전`}`;
  const body = document.createElement("div");
  body.style.cssText = "word-break:break-all";
  body.textContent = m.text;
  const tail = document.createElement("div");
  tail.style.cssText =
    "position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);border:6px solid transparent;border-top-color:#fff;border-bottom:0";
  el.append(who, body, tail);
  if (m.mine) el.style.outline = "2px solid #f5c451";
  return el;
}

const LONG_PRESS_MS = 600;

function pinHtml(s: SpotSummary, selected: boolean) {
  const closed = s.status === "closed";
  const stale =
    !closed &&
    (!s.lastConfirmedAt || Date.now() - new Date(s.lastConfirmedAt).getTime() > STALE_DAYS * 86400_000);
  const color = guardColor(s.guardAvg, closed);
  const scale = selected ? 1.25 : 1;
  const fleet = s.parkedCount >= FLEET_SIZE;
  const icon = closed ? "🚧" : fleet ? "⛵" : "☠";
  const tag = (pos: string, bg: string, fg: string, text: string, extra = "") =>
    `<span style="position:absolute;${pos};height:20px;padding:0 6px;border-radius:10px;background:${bg};color:${fg};font:800 11px/20px sans-serif;white-space:nowrap;border:2px solid #07111f;${extra}">${text}</span>`;
  const count = s.parkedCount > 0 ? tag("top:-6px;right:-10px", "#f5c451", "#07111f", String(s.parkedCount)) : "";
  const bounty = s.bounty > 0 ? tag("bottom:-8px;left:50%;transform:translateX(-50%)", "#16a34a", "#fff", `💰${s.bounty}`) : "";
  const crown = s.discovererIsKing ? `<span style="position:absolute;top:-14px;left:2px;font-size:16px">👑</span>` : "";
  const navy = s.navyAlert
    ? tag("top:-6px;left:-12px", "#dc2626", "#fff", "⚠", "animation:pp-blink 1s steps(2) infinite")
    : "";
  const lord = s.lord
    ? `<span style="position:absolute;bottom:-2px;right:-8px;width:22px;height:22px;border-radius:50%;background:#0b1a2e;border:2px solid #f5c451;font-size:12px;line-height:18px;text-align:center">${s.lord.flag}</span>`
    : "";
  const treasure = s.treasure
    ? `<span style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:20px;animation:pp-bob 1.2s ease-in-out infinite">📦</span>`
    : "";
  // 전설의 정박지: 금테 + 빛
  const border = selected ? "#f5c451" : s.legendary ? "#f5c451" : "#fff";
  const glow = s.legendary ? ",0 0 0 3px #07111f,0 0 14px 4px rgba(245,196,81,.8)" : "";
  // 오래 확인 안 된 핀은 흐리게 (현상금 표시는 또렷하게 유지)
  return `
    <div data-spot="${s.id}" style="position:relative;transform:translateY(-50%) scale(${scale});transform-origin:bottom center;cursor:pointer;padding:8px">
      <div style="opacity:${stale ? 0.45 : 1};width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid ${border};box-shadow:0 2px 6px rgba(0,0,0,.5)${glow};display:flex;align-items:center;justify-content:center">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1">${icon}</span>
      </div>
      ${treasure}${crown}${count}${navy}${lord}${bounty}
    </div>`;
}

export default function KakaoMap({
  ref,
  initialCenter,
  initialLevel = 4,
  spots,
  selectedId,
  onSpotTap,
  onLongPress,
  onReady,
  fogExplored = null,
  radios = [],
  wonders = [],
  onWonderTap,
}: Props) {
  const wonderRef = useRef<any[]>([]);
  const fogRef = useRef<any[]>([]);
  const radioRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<Kakao | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const meRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // 최신 콜백을 이벤트 핸들러에서 쓰기 위해 ref로 보관
  const cb = useRef({ onSpotTap, onLongPress, onReady, onWonderTap });
  useEffect(() => {
    cb.current = { onSpotTap, onLongPress, onReady, onWonderTap };
  });

  useImperativeHandle(ref, () => ({
    get kakao() {
      return kakaoRef.current;
    },
    panTo(p, level) {
      const map = mapRef.current;
      const kakao = kakaoRef.current;
      if (!map || !kakao) return;
      if (level) map.setLevel(level);
      map.panTo(new kakao.maps.LatLng(p.lat, p.lng));
    },
    getCenter() {
      const c = mapRef.current?.getCenter();
      return c ? { lat: c.getLat(), lng: c.getLng() } : null;
    },
    setMyLocation(p) {
      const map = mapRef.current;
      const kakao = kakaoRef.current;
      if (!map || !kakao) return;
      meRef.current?.setMap(null);
      meRef.current = null;
      if (!p) return;
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.25)";
      meRef.current = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(p.lat, p.lng),
        content: el,
        zIndex: 1,
      });
      meRef.current.setMap(map);
    },
  }));

  // 지도 생성 (한 번)
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number } | null = null;
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      start = null;
    };
    const fireAt = (clientX: number, clientY: number) => {
      const map = mapRef.current;
      const kakao = kakaoRef.current;
      if (!map || !kakao) return;
      const rect = container.getBoundingClientRect();
      const ll = map
        .getProjection()
        .coordsFromContainerPoint(new kakao.maps.Point(clientX - rect.left, clientY - rect.top));
      cb.current.onLongPress({ lat: ll.getLat(), lng: ll.getLng() });
    };
    const onTouchStart = (e: TouchEvent) => {
      cancel();
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest("[data-spot]")) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      timer = setTimeout(() => {
        if (start) {
          navigator.vibrate?.(30);
          fireAt(start.x, start.y);
        }
        cancel();
      }, LONG_PRESS_MS);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      if (e.touches.length !== 1 || Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) cancel();
    };
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", cancel);
    container.addEventListener("touchcancel", cancel);

    loadKakao()
      .then((kakao) => {
        if (cancelled) return;
        kakaoRef.current = kakao;
        const map = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
          level: initialLevel,
        });
        mapRef.current = map;
        // 데스크톱: 오른쪽 클릭으로 등록
        kakao.maps.event.addListener(map, "rightclick", (e: any) => {
          cb.current.onLongPress({ lat: e.latLng.getLat(), lng: e.latLng.getLng() });
        });
        setReady(true);
        cb.current.onReady?.(kakao);
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      cancelled = true;
      cancel();
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", cancel);
      container.removeEventListener("touchcancel", cancel);
    };
    // initialCenter는 처음 한 번만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀 다시 그리기
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!ready || !map || !kakao) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = spots.map((s) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = pinHtml(s, s.id === selectedId);
      const el = wrap.firstElementChild as HTMLElement;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onSpotTap(s.id);
      });
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(s.lat, s.lng),
        content: el,
        clickable: true,
        yAnchor: 0.5,
        zIndex: s.id === selectedId ? 10 : s.status === "closed" ? 2 : 3,
      });
      overlay.setMap(map);
      return overlay;
    });
  }, [ready, spots, selectedId]);

  // 해도(안개) 그리기: 안 밝혀진 칸은 어둡게, 밝혀진 칸은 금색 테두리
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!ready || !map || !kakao) return;
    fogRef.current.forEach((r) => r.setMap(null));
    fogRef.current = [];
    if (!fogExplored) return;
    fogRef.current = YEOUIDO_CELLS.map((c) => {
      const lit = fogExplored.has(c.id);
      const rect = new kakao.maps.Rectangle({
        bounds: new kakao.maps.LatLngBounds(
          new kakao.maps.LatLng(c.south, c.west),
          new kakao.maps.LatLng(c.north, c.east),
        ),
        strokeWeight: 1,
        strokeColor: lit ? "#f5c451" : "#07111f",
        strokeOpacity: lit ? 0.9 : 0.4,
        fillColor: lit ? "#f5c451" : "#07111f",
        fillOpacity: lit ? 0.12 : 0.55,
      });
      rect.setMap(map);
      return rect;
    });
  }, [ready, fogExplored]);

  // 궁금한 곳 ❓
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!ready || !map || !kakao) return;
    wonderRef.current.forEach((o) => o.setMap(null));
    wonderRef.current = wonders.map((w) => {
      const el = document.createElement("div");
      el.setAttribute("data-spot", "wonder"); // 길게 누르기 대상에서 제외
      el.style.cssText =
        "transform:translateY(-50%);width:30px;height:30px;border-radius:50%;background:#7c3aed;border:3px solid " +
        (w.mine ? "#f5c451" : "#fff") +
        ";box-shadow:0 2px 6px rgba(0,0,0,.5);color:#fff;font:900 16px/24px sans-serif;text-align:center;cursor:pointer";
      el.textContent = "?";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onWonderTap?.(w.id);
      });
      const o = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(w.lat, w.lng),
        content: el,
        clickable: true,
        yAnchor: 0.5,
        zIndex: 4,
      });
      o.setMap(map);
      return o;
    });
  }, [ready, wonders]);

  // 무전 말풍선
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!ready || !map || !kakao) return;
    radioRef.current.forEach((o) => o.setMap(null));
    radioRef.current = radios.map((m) => {
      const o = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(m.lat, m.lng),
        content: radioEl(m),
        yAnchor: 0,
        zIndex: 5,
      });
      o.setMap(map);
      return o;
    });
  }, [ready, radios]);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="h-full w-full select-none"
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-sea-950 p-8 text-center text-slate-300">
          {error}
        </div>
      )}
    </div>
  );
}
