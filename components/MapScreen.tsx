"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { randomFortune, RADIO_MAX_LEN, REWARD, WEATHERS, WONDER_NOTE_MAX, type WeatherId } from "@/lib/game";
import { getPosition, type Kakao, type LatLng } from "@/lib/kakao";
import type { ActiveParking, RadioMessage, SpotSummary, Wonder } from "@/lib/types";
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
const HINT_KEY = "pp_map_hint_v2";

type Purpose = "spot" | "wonder" | "radio";
type Mode =
  | { kind: "idle" }
  | { kind: "menu"; position: LatLng | null } // 무엇을 찍을지 고르기 (길게 누르면 위치가 정해져 있음)
  | { kind: "placing"; purpose: Purpose }
  | { kind: "new"; position: LatLng }
  | { kind: "wonder-new"; position: LatLng }
  | { kind: "wonder"; wonder: Wonder }
  | { kind: "radio"; position: LatLng }
  | { kind: "report"; spot: SpotSummary };

type SpotsResponse = { spots: SpotSummary[]; weather: WeatherId };

const PURPOSE_HINT: Record<Purpose, string> = {
  spot: "지도를 움직여 📍를 정박지 위에 맞춰 주세요",
  wonder: "지도를 움직여 📍를 궁금한 곳에 맞춰 주세요",
  radio: "지도를 움직여 📍를 무전 남길 곳에 맞춰 주세요",
};

export default function MapScreen({ initialFog = false }: { initialFog?: boolean }) {
  const mapRef = useRef<KakaoMapHandle>(null);
  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [radios, setRadios] = useState<RadioMessage[]>([]);
  const [wonders, setWonders] = useState<Wonder[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [toastNode, showToast] = useToast("bottom-40"); // 하단 도구 막대 위로
  const [confirmNode, confirm] = useConfirm();

  const explored = useMemo(() => exploredCells(spots), [spots]);
  const fogPercent = Math.round((explored.size / YEOUIDO_CELLS.length) * 100);

  const refresh = useCallback(
    () =>
      Promise.all([
        api<SpotsResponse>("/api/spots"),
        api<{ parking: ActiveParking }>("/api/parkings/current"),
        api<{ messages: RadioMessage[] }>("/api/radio"),
        api<{ wonders: Wonder[]; canDeleteAll: boolean }>("/api/wonders"),
      ])
        .then(([s, p, r, w]) => {
          setSpots(s.spots);
          setWeather(s.weather);
          setParking(p.parking);
          setRadios(r.messages);
          setWonders(w.wonders);
          setIsAdmin(w.canDeleteAll);
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

  /** 내 위치는 지도에 점으로만 보여 준다 (서버로 보내지 않음) */
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
    const res = await api<{ parking: ActiveParking; earned: number; fleet: boolean; events: string[] }>(
      "/api/parkings",
      { method: "POST", json: { spotId: spot.id } },
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

  function startPlacing(purpose: Purpose) {
    dismissHint();
    setSelectedId(null);
    setMode({ kind: "placing", purpose });
  }

  /** 메뉴에서 고른 뒤: 위치가 정해져 있으면 바로 입력, 아니면 지도로 위치 고르기 */
  function choose(purpose: Purpose, position: LatLng | null) {
    if (!position) return setMode({ kind: "placing", purpose });
    if (purpose === "spot") setMode({ kind: "new", position });
    else if (purpose === "wonder") setMode({ kind: "wonder-new", position });
    else setMode({ kind: "radio", position });
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
        wonders={wonders}
        selectedId={selectedId}
        fogExplored={fog ? explored : null}
        onSpotTap={(id) => {
          if (placing) return;
          dismissHint();
          setSelectedId(id);
        }}
        onWonderTap={(id) => {
          if (placing) return;
          const found = wonders.find((x) => x.id === id);
          if (found) setMode({ kind: "wonder", wonder: found });
        }}
        onLongPress={(position) => {
          dismissHint();
          setSelectedId(null);
          setMode({ kind: "menu", position });
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
            {PURPOSE_HINT[mode.purpose]}
          </div>
        )}
        {hint && !placing && (
          <div className="pointer-events-auto rounded-2xl border border-gold-400/40 bg-sea-900/95 p-3 text-sm shadow-lg">
            <div className="mb-1 font-bold text-gold-400">☠ 주차해적단 사용법</div>
            <ul className="space-y-0.5 text-slate-300">
              <li>· 핀을 누르면 정박지 정보와 [정박 시작]</li>
              <li>· 아래 [새 정박지] [궁금한 곳] [무전]으로 지도에 찍기 (길게 눌러도 돼요)</li>
              <li>· 📦 보물상자, 💰 현상금, ❓ 궁금한 곳을 노려 보세요</li>
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

      {/* 하단 도구 막대: 버튼마다 이름표. 자주 쓰는 '정박지'는 엄지가 닿는 오른쪽 끝 */}
      <div className="absolute inset-x-3 bottom-3 z-20">
        {placing ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button onClick={() => setMode({ kind: "idle" })} className="h-14 rounded-2xl bg-sea-700 px-6 font-bold shadow-lg">
              취소
            </button>
            <button
              onClick={() => {
                const c = mapRef.current?.getCenter();
                if (c) choose(mode.purpose, c);
              }}
              className="h-14 rounded-2xl bg-gold-400 font-black text-sea-950 shadow-lg"
            >
              이 위치로
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1 rounded-2xl bg-sea-900/95 p-1.5 shadow-xl backdrop-blur">
            <ToolButton icon="🗺️" label="해도" active={fog} onClick={() => setFog((f) => !f)} />
            <ToolButton icon="📻" label="무전" onClick={() => startPlacing("radio")} />
            <ToolButton icon="❓" label="궁금한 곳" onClick={() => startPlacing("wonder")} />
            <ToolButton
              icon={locating ? "…" : <LocateIcon />}
              label="내 위치"
              disabled={locating}
              onClick={() => void locateMe()}
            />
            <ToolButton icon="☠" label="새 정박지" primary onClick={() => startPlacing("spot")} />
          </div>
        )}
      </div>

      {toastNode}
      {confirmNode}

      {mode.kind === "menu" && (
        <Sheet onClose={() => setMode({ kind: "idle" })} title={<h2 className="text-lg font-black">무엇을 찍을까요?</h2>}>
          <div className="space-y-2 pb-1">
            <MenuItem
              icon="☠"
              title="정박지 등록"
              desc={`차단기 없는 단지를 발견했어요 · +${REWARD.discovery}💰`}
              onClick={() => choose("spot", mode.position)}
            />
            <MenuItem
              icon="❓"
              title="궁금한 곳 찍기"
              desc={`여기 차단기 있나? 누가 확인해 주면 +${REWARD.wonder}💰`}
              onClick={() => choose("wonder", mode.position)}
            />
            <MenuItem
              icon="📻"
              title="무전 남기기"
              desc="한 줄 쪽지, 1시간 동안 지도에 표시"
              onClick={() => choose("radio", mode.position)}
            />
          </div>
        </Sheet>
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
          onCreated={async (id, earned, newCell, wondersSolved) => {
            setMode({ kind: "idle" });
            await refresh();
            setSelectedId(id);
            const lines = [`☠ 새 정박지를 발견했어요! +${earned}💰`];
            if (newCell) lines.push("🗺️ 해도의 새 해역을 밝혔어요");
            if (wondersSolved) lines.push(`❓ 궁금한 곳 ${wondersSolved}개가 풀렸어요`);
            showToast(lines.join("\n"), 5000);
          }}
          onDuplicate={async (existing: ExistingSpot) => {
            setMode({ kind: "idle" });
            showToast(`이미 등록된 정박지가 있어요: ${existing.name}`);
            await refresh();
            focusSpot(existing);
          }}
        />
      )}

      {mode.kind === "wonder-new" && (
        <WonderComposeSheet
          position={mode.position}
          onClose={() => setMode({ kind: "idle" })}
          onSent={async () => {
            setMode({ kind: "idle" });
            showToast("❓ 궁금한 곳을 찍었어요. 선원들이 확인해 줄 거예요");
            await refresh();
          }}
        />
      )}

      {mode.kind === "wonder" && (
        <WonderSheet
          wonder={mode.wonder}
          canDelete={mode.wonder.mine || isAdmin}
          onClose={() => setMode({ kind: "idle" })}
          onRegister={() => setMode({ kind: "new", position: { lat: mode.wonder.lat, lng: mode.wonder.lng } })}
          onDelete={async () => {
            const ok = await confirm({ title: "궁금한 곳을 지울까요?", confirmLabel: "지우기", danger: true });
            if (!ok) return;
            try {
              await api(`/api/wonders/${mode.wonder.id}`, { method: "DELETE" });
              setMode({ kind: "idle" });
              showToast("❓ 궁금한 곳을 지웠어요");
              await refresh();
            } catch (e) {
              showToast((e as Error).message);
            }
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
          onDone={async ({ closed, earned, bounty, photoFailed }) => {
            setMode({ kind: "idle" });
            const lines = [
              (closed ? "🚧 차단기 제보가 쌓여 정박지를 닫았어요" : "📜 항해 일지를 남겼어요") +
                (earned > 0 ? ` +${earned}💰` : ""),
            ];
            if (bounty > 0) lines.push(`💰 현상금 ${bounty} 획득!`);
            if (photoFailed) lines.push("📷 사진은 올리지 못했어요. 일지는 저장됐어요");
            showToast(lines.join("\n"), 5000);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  active,
  primary,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const tone = primary
    ? "bg-gold-400 text-sea-950 active:bg-gold-500"
    : active
      ? "bg-gold-400/20 text-gold-400"
      : "text-slate-200 active:bg-sea-700";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl disabled:opacity-60 ${tone}`}
    >
      <span className="flex h-6 items-center text-xl leading-none">{icon}</span>
      <span className="text-[11px] leading-none font-bold">{label}</span>
    </button>
  );
}

/** 내 위치 아이콘 (과녁 모양 대신 흔히 쓰는 조준선) */
function LocateIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuItem({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-sea-800 px-4 py-3 text-left active:bg-sea-700">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sea-900 text-2xl">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="block text-xs text-slate-400">{desc}</span>
      </span>
    </button>
  );
}

function WonderComposeSheet({ position, onClose, onSent }: { position: LatLng; onClose: () => void; onSent: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quick = ["차단기 있나요?", "경비 엄한가요?", "방문 주차 되나요?", "지하 주차장 열려 있나요?"];
  async function send() {
    setBusy(true);
    setError("");
    try {
      await api("/api/wonders", { method: "POST", json: { note, lat: position.lat, lng: position.lng } });
      onSent();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Sheet
      onClose={onClose}
      title={<h2 className="text-lg font-black">❓ 궁금한 곳 찍기</h2>}
      footer={
        <Button onClick={send} disabled={busy} className="w-full">
          {busy ? "찍는 중…" : "❓ 찍기"}
        </Button>
      }
    >
      <p className="mb-2 text-xs text-slate-400">
        선원 모두에게 보여요. 누군가 근처(100m)에 정박지를 등록하면 자동으로 풀리고, 찍은 사람은 +{REWARD.wonder}💰를 받아요.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q} onClick={() => setNote(q)} className="h-9 rounded-full bg-sea-800 px-3 text-xs font-semibold">
            {q}
          </button>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, WONDER_NOTE_MAX))}
        placeholder="무엇이 궁금한가요? (선택)"
        className="h-12 w-full rounded-xl border border-sea-600 bg-sea-800 px-4 text-white outline-none placeholder:text-slate-500 focus:border-gold-400"
      />
      <div className="mt-1 text-right text-xs text-slate-500">
        {note.length}/{WONDER_NOTE_MAX}
      </div>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

function WonderSheet({
  wonder,
  canDelete,
  onClose,
  onRegister,
  onDelete,
}: {
  wonder: Wonder;
  canDelete: boolean;
  onClose: () => void;
  onRegister: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet
      onClose={onClose}
      title={
        <>
          <p className="text-xs font-bold text-violet-300">❓ 궁금한 곳</p>
          <h2 className="text-lg font-black break-words">{wonder.note || "여기 어때요?"}</h2>
        </>
      }
      footer={
        <div className={`grid gap-2 ${canDelete ? "grid-cols-[1fr_auto]" : ""}`}>
          <Button onClick={onRegister}>☠ 확인했어요, 정박지로 등록</Button>
          {canDelete && (
            <Button variant="ghost" onClick={onDelete} className="px-5">
              지우기
            </Button>
          )}
        </div>
      }
    >
      <p className="text-sm text-slate-300">
        {wonder.mine ? "내가" : `${wonder.nickname}님이`} {timeAgo(wonder.createdAt)}에 찍었어요.
      </p>
      <p className="mt-2 pb-1 text-xs text-slate-400">
        가 보고 차단기가 없으면 정박지로 등록해 주세요. 발견 금화를 받고, 찍은 선원도 +{REWARD.wonder}💰를 받아요.
      </p>
    </Sheet>
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
