"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { randomFortune, RADIO_MAX_LEN, WEATHERS, type WeatherId } from "@/lib/game";
import { getPosition, type Kakao, type LatLng } from "@/lib/kakao";
import type { ActiveParking, RadioMessage, SpotSummary } from "@/lib/types";
import { exploredCells, YEOUIDO_CELLS } from "@/lib/yeouido";
import { useConfirm, useToast } from "./feedback";
import KakaoMap, { type KakaoMapHandle } from "./KakaoMap";
import NewSpotSheet, { type ExistingSpot } from "./NewSpotSheet";
import ParkingBanner from "./ParkingBanner";
import ReportSheet from "./ReportSheet";
import Sheet from "./Sheet";
import SpotSheet from "./SpotSheet";
import { Button, ErrorText } from "./ui";

const POLL_MS = 30_000;
// 여의도 위주로 쓰므로 지도는 여의도에서 시작한다 (내 위치는 🎯 버튼으로 이동)
const START_CENTER: LatLng = { lat: 37.5255, lng: 126.9245 };
const START_LEVEL = 6; // 여의도 섬 전체가 보이는 정도
const HINT_KEY = "pp_map_hint_v1";

type Mode =
  | { kind: "idle" }
  | { kind: "placing"; purpose: "spot" | "radio" }
  | { kind: "new"; position: LatLng }
  | { kind: "radio"; position: LatLng }
  | { kind: "report"; spot: SpotSummary };

type SpotsResponse = { spots: SpotSummary[]; weather: WeatherId };

export default function MapScreen({ initialFog = false }: { initialFog?: boolean }) {
  const mapRef = useRef<KakaoMapHandle>(null);
  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [radios, setRadios] = useState<RadioMessage[]>([]);
  const [weather, setWeather] = useState<WeatherId>("calm");
  const [parking, setParking] = useState<ActiveParking>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [ending, setEnding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [kakao, setKakao] = useState<Kakao | null>(null);
  const [fog, setFog] = useState(initialFog);
  const [hint, setHint] = useState(false);
  const lastAlertRef = useRef<string | null>(null);
  const [toastNode, showToast] = useToast();
  const [confirmNode, confirm] = useConfirm();

  const explored = useMemo(() => exploredCells(spots), [spots]);
  const fogPercent = Math.round((explored.size / YEOUIDO_CELLS.length) * 100);

  const refresh = useCallback(
    () =>
      Promise.all([
        api<SpotsResponse>("/api/spots"),
        api<{ parking: ActiveParking }>("/api/parkings/current"),
        api<{ messages: RadioMessage[] }>("/api/radio"),
      ])
        .then(([s, p, r]) => {
          setSpots(s.spots);
          setWeather(s.weather);
          setParking(p.parking);
          setRadios(r.messages);
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
    const res = await api<{ parking: ActiveParking; earned: number; fleet: boolean; events: string[] }>(
      "/api/parkings",
      { method: "POST", json: { spotId: spot.id, lat: p.lat, lng: p.lng } },
    );
    setParking(res.parking);
    setSelectedId(null);
    const lines = [
      `⚓ ${spot.name}에 정박했어요${res.earned > 0 ? ` +${res.earned}💰` : ""}`,
      ...(res.fleet ? ["⛵ 함대 집결!"] : []),
      ...res.events,
      `🔮 ${randomFortune()}`,
    ];
    if (res.events.length) navigator.vibrate?.(80);
    showToast(lines.join("\n"), 6500);
    void refresh();
  }

  async function endParking() {
    if (!parking) return;
    const ok = await confirm({
      title: "출항할까요?",
      message: `${parking.spotName} 정박을 끝냅니다.`,
      confirmLabel: "⛵ 출항",
    });
    if (!ok) return;
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

  function dismissHint() {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* 저장 못 해도 괜찮다 */
    }
  }

  const selected = spots.find((s) => s.id === selectedId);
  const placing = mode.kind === "placing";
  const w = WEATHERS[weather];

  return (
    <div className="relative h-full w-full overflow-hidden">
      <KakaoMap
        ref={mapRef}
        initialCenter={START_CENTER}
        initialLevel={START_LEVEL}
        spots={spots}
        radios={radios}
        selectedId={selectedId}
        fogExplored={fog ? explored : null}
        onSpotTap={(id) => {
          if (placing) return;
          dismissHint();
          setSelectedId(id);
        }}
        onLongPress={(position) => {
          dismissHint();
          setSelectedId(null);
          setMode({ kind: "new", position });
        }}
        onReady={(k) => {
          setKakao(k);
          void locateMe(true, false); // 내 위치 점만 표시하고 화면은 여의도 유지
          try {
            if (!localStorage.getItem(HINT_KEY)) setHint(true);
          } catch {
            /* 무시 */
          }
        }}
      />

      {/* 상단: 날씨 · 정박 배너 · 해도 진행률 · 안내 */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 px-3 pt-3">
        {!parking && !placing && (
          <button
            onClick={() => showToast(`${w.icon} 이번 주 날씨: ${w.name}\n${w.desc}`)}
            className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-sea-900/90 px-3 text-xs font-bold shadow-lg"
          >
            <span className="text-base">{w.icon}</span>
            {w.name}
            {weather !== "calm" && <span className="text-gold-400">· {w.desc}</span>}
          </button>
        )}
        {parking && (
          <div className="pointer-events-auto">
            <ParkingBanner
              parking={parking}
              busy={ending}
              onEnd={endParking}
              onTap={() => {
                const s = spots.find((x) => x.id === parking.spotId);
                if (s) focusSpot(s);
              }}
            />
          </div>
        )}
        {fog && !placing && (
          <div className="pointer-events-auto rounded-2xl bg-sea-900/95 px-4 py-2 shadow-lg">
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
        {placing && (
          <div className="rounded-2xl bg-sea-900/95 px-4 py-3 text-center text-sm font-semibold shadow-lg">
            {mode.purpose === "spot"
              ? "지도를 움직여 📍를 정박지 위에 맞춰 주세요"
              : "지도를 움직여 📍를 무전 남길 곳에 맞춰 주세요"}
          </div>
        )}
        {hint && !placing && (
          <div className="pointer-events-auto rounded-2xl border border-gold-400/40 bg-sea-900/95 p-3 text-sm shadow-lg">
            <div className="mb-1 font-bold text-gold-400">☠ 주차해적단 사용법</div>
            <ul className="space-y-0.5 text-slate-300">
              <li>· 핀을 누르면 정박지 정보와 [정박 시작]</li>
              <li>· 지도를 길게 누르거나 [+ 정박지]로 새로 등록</li>
              <li>· 📦 보물상자, 💰 현상금 핀을 노려 보세요</li>
            </ul>
            <button onClick={dismissHint} className="mt-2 h-9 w-full rounded-lg bg-sea-700 text-xs font-bold">
              알겠어요
            </button>
          </div>
        )}
      </div>

      {/* 위치 선택 모드: 가운데 고정 핀 */}
      {placing && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-full text-5xl drop-shadow-lg">
          📍
        </div>
      )}

      {/* 왼쪽 아래: 보기 전환 */}
      {!placing && (
        <div className="absolute bottom-4 left-3 z-20 flex flex-col gap-3">
          <RoundButton label="무전 남기기" onClick={() => setMode({ kind: "placing", purpose: "radio" })}>
            📻
          </RoundButton>
          <RoundButton label="해도 보기" active={fog} onClick={() => setFog((f) => !f)}>
            🗺️
          </RoundButton>
        </div>
      )}

      {/* 오른쪽 아래: 주요 동작 (한 손 조작) */}
      <div className="absolute right-3 bottom-4 z-20 flex flex-col items-end gap-3">
        {!placing && (
          <RoundButton label="내 위치" onClick={() => void locateMe()} disabled={locating}>
            {locating ? "…" : "🎯"}
          </RoundButton>
        )}
        {placing ? (
          <div className="flex gap-2">
            <button onClick={() => setMode({ kind: "idle" })} className="h-14 rounded-full bg-sea-700 px-5 font-bold shadow-lg">
              취소
            </button>
            <button
              onClick={() => {
                const c = mapRef.current?.getCenter();
                if (!c) return;
                setMode(mode.purpose === "spot" ? { kind: "new", position: c } : { kind: "radio", position: c });
              }}
              className="h-14 rounded-full bg-gold-400 px-5 font-black text-sea-950 shadow-lg"
            >
              이 위치로
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              dismissHint();
              setSelectedId(null);
              setMode({ kind: "placing", purpose: "spot" });
            }}
            className="h-14 rounded-full bg-gold-400 px-5 font-black text-sea-950 shadow-lg active:bg-gold-500"
          >
            + 정박지
          </button>
        )}
      </div>

      {toastNode}
      {confirmNode}

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
          onChanged={(msg) => {
            showToast(msg);
            void refresh();
          }}
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
            showToast(`☠ 새 정박지를 발견했어요! +${earned}💰${newCell ? "\n🗺️ 해도의 새 해역을 밝혔어요" : ""}`, 5000);
          }}
          onDuplicate={async (existing: ExistingSpot) => {
            setMode({ kind: "idle" });
            showToast(`이미 등록된 정박지가 있어요: ${existing.name}`);
            await refresh();
            focusSpot(existing);
          }}
        />
      )}

      {mode.kind === "radio" && (
        <RadioSheet
          position={mode.position}
          onClose={() => setMode({ kind: "idle" })}
          onSent={async () => {
            setMode({ kind: "idle" });
            showToast("📻 무전을 보냈어요. 1시간 동안 지도에 떠 있어요");
            await refresh();
          }}
        />
      )}

      {mode.kind === "report" && (
        <ReportSheet
          spot={mode.spot}
          weather={weather}
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

function RoundButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg disabled:opacity-60 ${
        active ? "bg-gold-400" : "bg-sea-900 active:bg-sea-700"
      }`}
    >
      {children}
    </button>
  );
}

function RadioSheet({ position, onClose, onSent }: { position: LatLng; onClose: () => void; onSent: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quick = ["지금 자리 넉넉함", "자리 꽉 참", "경비 순찰 중", "입구 막힘", "여기 안전"];

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api("/api/radio", { method: "POST", json: { text, lat: position.lat, lng: position.lng } });
      onSent();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={<h2 className="text-lg font-black">📻 무전 남기기</h2>}
      footer={
        <Button onClick={send} disabled={busy || !text.trim()} className="w-full">
          {busy ? "보내는 중…" : "무전 보내기"}
        </Button>
      }
    >
      <p className="mb-2 text-xs text-slate-400">고른 위치에 1시간 동안 말풍선으로 떠 있어요.</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q} onClick={() => setText(q)} className="h-9 rounded-full bg-sea-800 px-3 text-xs font-semibold">
            {q}
          </button>
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, RADIO_MAX_LEN))}
        placeholder="한 줄 무전 (60자)"
        className="h-12 w-full rounded-xl border border-sea-600 bg-sea-800 px-4 text-white outline-none placeholder:text-slate-500 focus:border-gold-400"
      />
      <div className="mt-1 text-right text-xs text-slate-500">
        {text.length}/{RADIO_MAX_LEN}
      </div>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}
