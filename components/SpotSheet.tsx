"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GUARD_LABELS, guardColor, timeAgo } from "@/lib/format";
import type { ActiveParking, SpotReport, SpotSummary } from "@/lib/types";
import Sheet from "./Sheet";
import { Button, ErrorText } from "./ui";

type Props = {
  spotId: string;
  fallback?: SpotSummary;
  refreshKey: number;
  parking: ActiveParking;
  onClose: () => void;
  onStartParking: (spot: SpotSummary) => Promise<void>;
  onWriteReport: (spot: SpotSummary) => void;
};

export default function SpotSheet({ spotId, fallback, refreshKey, parking, onClose, onStartParking, onWriteReport }: Props) {
  const [spot, setSpot] = useState<SpotSummary | undefined>(fallback);
  const [reports, setReports] = useState<SpotReport[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ spot: SpotSummary; reports: SpotReport[] }>(`/api/spots/${spotId}`)
      .then((d) => {
        if (!alive) return;
        setSpot(d.spot);
        setReports(d.reports);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [spotId, refreshKey]);

  if (!spot) return null;
  const closed = spot.status === "closed";
  const parkedHere = parking?.spotId === spot.id;

  async function start() {
    if (!spot) return;
    setBusy(true);
    setError("");
    try {
      await onStartParking(spot);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={
        <>
          <h2 className="truncate text-xl font-black">{spot.name}</h2>
          {spot.address && <p className="truncate text-sm text-slate-400">{spot.address}</p>}
        </>
      }
    >
      {closed && (
        <div className="mb-3 rounded-xl bg-slate-700 px-3 py-2 text-sm">🚧 차단기가 생겼다는 제보가 있어 닫힌 정박지예요.</div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="정박 중" value={`${spot.parkedCount}명`} />
        <Stat
          label="경계 레벨"
          value={
            <span style={{ color: guardColor(spot.guardAvg, false) }}>
              {spot.guardAvg == null ? "정보 없음" : spot.guardAvg.toFixed(1)}
            </span>
          }
          sub={spot.guardAvg == null ? "최근 14일" : GUARD_LABELS[Math.round(spot.guardAvg)]}
        />
        <Stat label="마지막 확인" value={timeAgo(spot.lastConfirmedAt)} small />
      </div>

      <p className="mt-3 text-xs text-slate-400">
        ☠ 발견: <b className="text-slate-200">{spot.discoverer}</b> · {timeAgo(spot.createdAt)}
      </p>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-bold text-slate-300">최근 항해 일지</h3>
        {reports === null ? (
          <p className="text-sm text-slate-500">불러오는 중…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-500">아직 일지가 없어요. 첫 일지를 남겨 주세요.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl bg-sea-800 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                  <b className="text-slate-200">{r.nickname}</b>
                  <span>{timeAgo(r.createdAt)}</span>
                  {r.guardLevel != null && (
                    <span style={{ color: guardColor(r.guardLevel, false) }}>경계 {r.guardLevel}</span>
                  )}
                  {r.gateStatus === "no_gate" && <span className="text-green-400">차단기 없음</span>}
                  {r.gateStatus === "gate_installed" && <span className="text-red-400">차단기 생김</span>}
                </div>
                {r.note && <p className="mt-1 text-sm break-words whitespace-pre-wrap">{r.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {parkedHere ? (
          <div className="flex min-h-12 items-center justify-center rounded-xl bg-sea-700 font-bold text-gold-400">
            ⚓ 정박 중
          </div>
        ) : (
          <Button onClick={start} disabled={busy || closed || !!parking}>
            {busy ? "위치 확인 중…" : parking ? "다른 곳 정박 중" : "정박 시작"}
          </Button>
        )}
        <Button variant="ghost" onClick={() => onWriteReport(spot)}>
          일지 쓰기
        </Button>
      </div>
    </Sheet>
  );
}

function Stat({ label, value, sub, small }: { label: string; value: React.ReactNode; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-sea-800 px-2 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 font-black ${small ? "text-sm" : "text-lg"}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
