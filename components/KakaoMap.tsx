"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { guardColor } from "@/lib/format";
import { loadKakao, type Kakao, type LatLng } from "@/lib/kakao";
import { STALE_DAYS } from "@/lib/constants";
import type { SpotSummary } from "@/lib/types";

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
};

const LONG_PRESS_MS = 600;

function pinHtml(s: SpotSummary, selected: boolean) {
  const closed = s.status === "closed";
  const stale =
    !closed &&
    (!s.lastConfirmedAt || Date.now() - new Date(s.lastConfirmedAt).getTime() > STALE_DAYS * 86400_000);
  const color = guardColor(s.guardAvg, closed);
  const scale = selected ? 1.25 : 1;
  const badge =
    s.parkedCount > 0
      ? `<span style="position:absolute;top:-6px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#f5c451;color:#07111f;font:800 12px/20px sans-serif;text-align:center;border:2px solid #07111f">${s.parkedCount}</span>`
      : "";
  return `
    <div data-spot="${s.id}" style="position:relative;transform:translateY(-50%) scale(${scale});transform-origin:bottom center;opacity:${stale ? 0.45 : 1};cursor:pointer;padding:6px">
      <div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid ${selected ? "#f5c451" : "#fff"};box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1">${closed ? "🚧" : "☠"}</span>
      </div>
      ${badge}
    </div>`;
}

export default function KakaoMap({ ref, initialCenter, initialLevel = 4, spots, selectedId, onSpotTap, onLongPress, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<Kakao | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const meRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // 최신 콜백을 이벤트 핸들러에서 쓰기 위해 ref로 보관
  const cb = useRef({ onSpotTap, onLongPress, onReady });
  useEffect(() => {
    cb.current = { onSpotTap, onLongPress, onReady };
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
