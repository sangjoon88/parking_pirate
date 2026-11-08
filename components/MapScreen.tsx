"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getPosition, type Kakao, type LatLng } from "@/lib/kakao";
import { randomFortune } from "@/lib/game";
import type { ActiveParking, SpotSummary } from "@/lib/types";
import { exploredCells, YEOUIDO_CELLS } from "@/lib/yeouido";
import KakaoMap, { type KakaoMapHandle } from "./KakaoMap";
import NewSpotSheet, { type ExistingSpot } from "./NewSpotSheet";
import ParkingBanner from "./ParkingBanner";
import ReportSheet from "./ReportSheet";
import SpotSheet from "./SpotSheet";

const POLL_MS = 30_000;
// 여의도 위주로 쓰므로 지도는 여의도에서 시작한다 (내 위치는 🎯 버튼으로 이동)
const START_CENTER: LatLng = { lat: 37.5255, lng: 126.9245 };
const START_LEVEL = 6; // 여의도 섬 전체가 보이는 정도

type Mode =
  | { kind: "idle" }
  | { kind: "placing" }
  | { kind: "new"; position: LatLng }
  | { kind: "report"; spot: SpotSummary };

export default function MapScreen({ initialFog = false }: { initialFog?: boolean }) {
  const mapRef = useRef<KakaoMapHandle>(null);
  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [parking, setParking] = useState<ActiveParking>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState("");
  const [ending, setEnding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [kakao, setKakao] = useState<Kakao | null>(null);
  const [fog, setFog] = useState(initialFog);
  const lastAlertRef = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, ms = 3500) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), ms);
  }, []);

  const explored = useMemo(() => exploredCells(spots), [spots]);
  const fogPercent = Math.round((explored.size / YEOUIDO_CELLS.length) * 100);

  const refresh = useCallback(
    () =>
      Promise.all([
        api<{ spots: SpotSummary[] }>("/api/spots"),
        api<{ parking: ActiveParking }>("/api/parkings/current"),
      ])
        .then(([s, p]) => {
          setSpots(s.spots);
          setParking(p.parking);
          setRefreshKey((k) => k + 1);
          // 해군 출몰 경보: 내가 정박한 곳에 새 경보가 뜨면 진동 + 알림
          const alert = p.parking?.navyAlert;
          if (alert && alert.at !== lastAlertRef.current) {
            lastAlertRef.current = alert.at;
            navigator.vibrate?.([200, 100, 200]);
            showToast(`⚠ 해군 출몰! ${alert.by}님이 경계 5를 제보했어요`, 6000);
          }
        })
        .catch(() => {
          // 폴링 실패는 조용히 넘어간다
        }),
    [showToast],
  );

  // 30초 폴링 + 앱으로 돌아왔을 때 즉시 갱신
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const locateMe = useCallback(
    async (silent = false, pan = true) => {
      setLocating(true);
      try {
        const p = await getPosition(false);
        mapRef.current?.setMyLocation(p);
        if (pan) mapRef.current?.panTo(p);
      } catch (e) {
        if (!silent) showToast((e as Error).message);
      } finally {
        setLocating(false);
      }
    },
    [showToast],
  );

  async function startParking(spot: SpotSummary) {
    const p = await getPosition(true);
    mapRef.current?.setMyLocation(p);
    // 좌표는 거리 확인용으로만 서버에 보내고, 서버는 저장하지 않는다
    const res = await api<{ parking: ActiveParking; earned: number; fleet: boolean }>("/api/parkings", {
      method: "POST",
      json: { spotId: spot.id, lat: p.lat, lng: p.lng },
    });
    setParking(res.parking);
    const gold = res.earned > 0 ? ` +${res.earned}💰` : "";
    const fleet = res.fleet ? "\n⛵ 함대 집결!" : "";
    showToast(`⚓ ${spot.name}에 정박했어요${gold}${fleet}\n🔮 ${randomFortune()}`, 6000);
    void refresh();
  }

  async function endParking() {
    if (!confirm("출항할까요? (정박 종료)")) return;
    setEnding(true);
    try {
      await api("/api/parkings/end", { method: "POST" });
      setParking(null);
      showToast("⛵ 출항했어요. 순항하세요!");
      void refresh();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setEnding(false);
    }
  }

  function focusSpot(s: { id: string; lat: number; lng: number }) {
    mapRef.current?.panTo({ lat: s.lat, lng: s.lng });
    setSelectedId(s.id);
  }

  const selected = spots.find((s) => s.id === selectedId);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <KakaoMap
        ref={mapRef}
        initialCenter={START_CENTER}
        initialLevel={START_LEVEL}
        spots={spots}
        selectedId={selectedId}
        onSpotTap={(id) => {
          if (mode.kind === "placing") return;
          setSelectedId(id);
        }}
        onLongPress={(position) => {
          setSelectedId(null);
          setMode({ kind: "new", position });
        }}
        fogExplored={fog ? explored : null}
        onReady={(k) => {
          setKakao(k);
          void locateMe(true, false); // 내 위치 점만 표시하고 화면은 여의도 유지
        }}
      />

      {/* 상단: 정박 배너 */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3">
        <div className="pointer-events-auto">
          {parking && (
            <ParkingBanner
              parking={parking}
              busy={ending}
              onEnd={endParking}
              onTap={() => {
                const s = spots.find((x) => x.id === parking.spotId);
                if (s) focusSpot(s);
              }}
            />
          )}
          {fog && mode.kind !== "placing" && (
            <div className="mt-2 rounded-2xl bg-sea-900/95 px-4 py-2 shadow-lg">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>🗺️ 여의도 해도</span>
                <span className="text-gold-400">
                  {explored.size}/{YEOUIDO_CELLS.length} 해역 · {fogPercent}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sea-700">
                <div className="h-full bg-gold-400" style={{ width: `${fogPercent}%` }} />
              </div>
            </div>
          )}
          {mode.kind === "placing" && (
            <div className="mt-2 rounded-2xl bg-sea-900/95 px-4 py-3 text-center text-sm font-semibold shadow-lg">
              지도를 움직여 ☠ 표시를 정박지 위에 맞춰 주세요
            </div>
          )}
        </div>
      </div>

      {/* 위치 선택 모드: 가운데 고정 핀 */}
      {mode.kind === "placing" && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-full text-5xl drop-shadow-lg">
          📍
        </div>
      )}

      {/* 하단 조작 버튼 (한 손 조작용으로 오른쪽 아래 모음) */}
      <div className="absolute right-3 bottom-4 z-20 flex flex-col items-end gap-3">
        <button
          onClick={() => setFog((f) => !f)}
          aria-label="해도 보기"
          className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg ${
            fog ? "bg-gold-400" : "bg-sea-900 active:bg-sea-700"
          }`}
        >
          🗺️
        </button>
        <button
          onClick={() => void locateMe()}
          disabled={locating}
          aria-label="내 위치"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-sea-900 text-2xl shadow-lg active:bg-sea-700 disabled:opacity-60"
        >
          {locating ? "…" : "🎯"}
        </button>
        {mode.kind === "placing" ? (
          <div className="flex gap-2">
            <button
              onClick={() => setMode({ kind: "idle" })}
              className="h-14 rounded-full bg-sea-700 px-5 font-bold shadow-lg"
            >
              취소
            </button>
            <button
              onClick={() => {
                const c = mapRef.current?.getCenter();
                if (c) setMode({ kind: "new", position: c });
              }}
              className="h-14 rounded-full bg-gold-400 px-5 font-black text-sea-950 shadow-lg"
            >
              이 위치로 등록
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setSelectedId(null);
              setMode({ kind: "placing" });
            }}
            className="h-14 rounded-full bg-gold-400 px-5 font-black text-sea-950 shadow-lg active:bg-gold-500"
          >
            + 정박지 등록
          </button>
        )}
      </div>

      {toast && (
        <div className="absolute inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <div className="rounded-2xl bg-black/85 px-4 py-2 text-center text-sm whitespace-pre-line">{toast}</div>
        </div>
      )}

      {selectedId && mode.kind === "idle" && (
        <SpotSheet
          key={selectedId}
          spotId={selectedId}
          fallback={selected}
          refreshKey={refreshKey}
          parking={parking}
          onClose={() => setSelectedId(null)}
          onStartParking={startParking}
          onWriteReport={(spot) => setMode({ kind: "report", spot })}
        />
      )}

      {mode.kind === "new" && (
        <NewSpotSheet
          kakao={kakao}
          position={mode.position}
          onClose={() => setMode({ kind: "idle" })}
          onCreated={async (id, earned, newCell) => {
            setMode({ kind: "idle" });
            await refresh();
            setSelectedId(id);
            showToast(
              `☠ 새 정박지를 발견했어요! +${earned}💰${newCell ? "\n🗺️ 해도의 새 해역을 밝혔어요" : ""}`,
              5000,
            );
          }}
          onDuplicate={async (existing: ExistingSpot) => {
            setMode({ kind: "idle" });
            await refresh();
            focusSpot(existing);
          }}
        />
      )}

      {mode.kind === "report" && (
        <ReportSheet
          spot={mode.spot}
          onClose={() => setMode({ kind: "idle" })}
          onDone={async ({ closed, earned, bounty }) => {
            setMode({ kind: "idle" });
            const msg = closed ? "🚧 차단기 제보가 쌓여 정박지를 닫았어요" : "📜 항해 일지를 남겼어요";
            const gold = earned > 0 ? ` +${earned}💰` : "";
            showToast(`${msg}${gold}${bounty > 0 ? `\n💰 현상금 ${bounty} 획득!` : ""}`, 5000);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
