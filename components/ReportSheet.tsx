"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { NOTE_MAX } from "@/lib/constants";
import { GUARD_LABELS, guardColor } from "@/lib/format";
import type { SpotSummary, WeatherId } from "@/lib/types";
import { uploadPhoto } from "@/lib/image";
import { PhotoPicker } from "./Photos";
import Sheet from "./Sheet";
import { Button, ErrorText } from "./ui";

export default function ReportSheet({
  spot,
  weather,
  onClose,
  onDone,
}: {
  spot: SpotSummary;
  weather: WeatherId;
  onClose: () => void;
  onDone: (result: { closed: boolean; earned: number; bounty: number; photoFailed: boolean }) => void;
}) {
  const [guardLevel, setGuardLevel] = useState<number | null>(null);
  const [gateStatus, setGateStatus] = useState<"no_gate" | "gate_installed" | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ id: string; closed: boolean; earned: number; bounty: number }>("/api/reports", {
        method: "POST",
        json: { spotId: spot.id, guardLevel, gateStatus, note, hasPhoto: !!photo },
      });
      let photoFailed = false;
      if (photo) {
        try {
          await uploadPhoto(spot.id, photo, res.id);
        } catch {
          photoFailed = true; // 일지는 이미 저장됨: 사진만 실패했다고 알린다
        }
      }
      onDone({ ...res, photoFailed });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={
        <>
          <p className="text-xs text-slate-400">항해 일지</p>
          <h2 className="truncate text-lg font-black">{spot.name}</h2>
        </>
      }
      footer={
        <Button
          onClick={submit}
          disabled={busy || (guardLevel === null && gateStatus === null && !note.trim() && !photo)}
          className="w-full"
        >
          {busy ? "기록 중…" : "일지 남기기"}
        </Button>
      }
    >
      {weather === "storm" && (
        <p className="mb-3 rounded-xl bg-sea-700 px-3 py-2 text-xs font-bold">🌪 폭풍 주간: 이번 주 일지 금화 2배!</p>
      )}
      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-300">경계 레벨</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = guardLevel === n;
            return (
              <button
                key={n}
                onClick={() => setGuardLevel(on ? null : n)}
                className="flex min-h-14 flex-col items-center justify-center rounded-xl border-2 text-sm font-black"
                style={{
                  borderColor: on ? guardColor(n, false) : "transparent",
                  background: on ? `${guardColor(n, false)}33` : "var(--color-sea-800)",
                }}
              >
                <span style={{ color: guardColor(n, false) }}>{n}</span>
                <span className="text-[10px] font-medium text-slate-300">{GUARD_LABELS[n]}</span>
              </button>
            );
          })}
        </div>
        {guardLevel === 5 && (
          <p className="mt-2 text-xs font-bold text-red-400">⚠ 이 정박지에 정박 중인 선원들에게 해군 출몰 경보가 30분간 뜹니다</p>
        )}
      </section>

      <section className="mt-4">
        <h3 className="mb-2 text-sm font-bold text-slate-300">차단기 상태</h3>
        <div className="grid grid-cols-2 gap-2">
          <Toggle on={gateStatus === "no_gate"} onClick={() => setGateStatus(gateStatus === "no_gate" ? null : "no_gate")}>
            ✅ 그대로 없음
          </Toggle>
          <Toggle
            on={gateStatus === "gate_installed"}
            danger
            onClick={() => setGateStatus(gateStatus === "gate_installed" ? null : "gate_installed")}
          >
            🚧 생겼음
          </Toggle>
        </div>
        {spot.bounty > 0 && (
          <p className="mt-2 text-xs text-green-400">
            💰 &ldquo;그대로 없음&rdquo;으로 확인하면 현상금 {spot.bounty}두블룬을 받아요
          </p>
        )}
      </section>

      <section className="mt-4">
        <h3 className="mb-2 flex justify-between text-sm font-bold text-slate-300">
          메모 <span className="font-normal text-slate-500">{note.length}/{NOTE_MAX}</span>
        </h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          placeholder="예: 지하 2층은 입주민 전용 표시. 지상 방문자 칸 넉넉함"
          className="w-full rounded-xl border border-sea-600 bg-sea-800 px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-gold-400"
        />
      </section>

      <section className="mt-4">
        <PhotoPicker file={photo} onChange={setPhoto} />
      </section>

      <div className="mt-3 pb-1">
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function Toggle({
  on,
  danger,
  onClick,
  children,
}: {
  on: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = danger ? "border-red-500 bg-red-500/20" : "border-green-500 bg-green-500/20";
  return (
    <button
      onClick={onClick}
      className={`min-h-12 rounded-xl border-2 font-bold ${on ? active : "border-transparent bg-sea-800"}`}
    >
      {children}
    </button>
  );
}
