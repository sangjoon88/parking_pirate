"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { loadKakao, type Kakao, type LatLng } from "@/lib/kakao";
import type { RadioMessage, SpotSummary, Wonder } from "@/lib/types";
import { pinHtml } from "@/lib/pinHtml";
import { compassSvg, wonderSvg } from "@/lib/pixelSprites";
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
    "transform:translateY(-100%);margin-top:-6px;max-width:180px;background:#f4ead2;color:#2b1d0e;border:2px solid #2b1d0e;padding:4px 8px;box-shadow:3px 3px 0 rgba(0,0,0,.45);font:600 12px/1.35 sans-serif;position:relative";
  const who = document.createElement("div");
  who.style.cssText = "font-size:10px;color:#64748b;font-weight:700";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(m.createdAt).getTime()) / 60000));
  who.textContent = `📻 ${m.nickname} · ${mins < 1 ? "방금" : `${mins}분 전`}`;
  const body = document.createElement("div");
  body.style.cssText = "word-break:break-all";
  body.textContent = m.text;
  const tail = document.createElement("div");
  tail.style.cssText =
    "position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);border:6px solid transparent;border-top-color:#2b1d0e;border-bottom:0";
  el.append(who, body, tail);
  if (m.mine) el.style.outline = "2px solid #f5c451";
  return el;
}

const LONG_PRESS_MS = 600;

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
      // 내 위치: 도트 느낌의 네모 점
      el.style.cssText =
        "width:16px;height:16px;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,.3),3px 3px 0 4px rgba(0,0,0,.35)";
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
        xAnchor: 0.5,
        yAnchor: 1, // 핀 끝이 실제 위치
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
      el.style.cssText = "transform:translateY(-50%);cursor:pointer;filter:drop-shadow(2px 2px 0 rgba(0,0,0,.5))";
      el.innerHTML = wonderSvg(3, w.mine);
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
        className="pp-map h-full w-full select-none"
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      />
      {/* 대항해시대 해도 느낌: 가장자리 양피지 그림자 + 나침반 (터치는 통과) */}
      <div className="pp-map-vignette pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute right-3 bottom-28 opacity-80"
        dangerouslySetInnerHTML={{ __html: compassSvg(4) }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-sea-950 p-8 text-center text-slate-300">
          {error}
        </div>
      )}
    </div>
  );
}
