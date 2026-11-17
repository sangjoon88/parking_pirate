"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { NOTE_MAX } from "@/lib/constants";
import { GUARD_LABELS, guardColor } from "@/lib/format";
import type { SpotReport, SpotSummary, WeatherId } from "@/lib/types";
import { uploadPhoto } from "@/lib/image";
import { PhotoPicker, photoUrl } from "./Photos";
import Sheet from "./Sheet";
import { Button, ErrorText } from "./ui";

/** 항해 일지 쓰기. editing을 주면 내가 쓴 일지 고치기 */
export default function ReportSheet({
  spot,
  weather,
  editing,
  onDelete,
  onClose,
  onDone,
}: {
  spot: SpotSummary;
  weather?: WeatherId;
  editing?: SpotReport;
  /** 고치기 화면에서 일지 지우기 */
  onDelete?: () => void;
  onClose: () => void;
  onDone: (result: { closed: boolean; earned: number; bounty: number; photoFailed: boolean }) => void;
}) {
  const [guardLevel, setGuardLevel] = useState<number | null>(editing?.guardLevel ?? null);
  const [gateStatus, setGateStatus] = useState<"no_gate" | "gate_installed" | null>(editing?.gateStatus ?? null);
  const [note, setNote] = useState(editing?.note ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  // 고칠 때 원래 붙어 있던 사진 (×로 빼면 null)
  const [keptPhotoId, setKeptPhotoId] = useState<string | null>(editing?.photoId ?? null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasPhoto = !!photo || !!keptPhotoId;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      let res: { id: string; closed: boolean; earned: number; bounty: number };
      if (editing) {
        const r = await api<{ closed: boolean }>(`/api/reports/${editing.id}`, {
          method: "PATCH",
          json: { guardLevel, gateStatus, note, hasPhoto },
        });
        res = { id: editing.id, closed: r.closed, earned: 0, bounty: 0 };
      } else {
        res = await api<{ id: string; closed: boolean; earned: number; bounty: number }>("/api/reports", {
          method: "POST",
          json: { spotId: spot.id, guardLevel, gateStatus, note, hasPhoto },
        });
      }
      let photoFailed = false;
      try {
        // 원래 사진을 뺐으면 먼저 지워야 새 사진을 붙일 수 있다 (일지당 1장)
        if (editing?.photoId && !keptPhotoId) await api(`/api/photos/${editing.photoId}`, { method: "DELETE" });
        if (photo) await uploadPhoto(spot.id, photo, res.id);
      } catch {
        photoFailed = true; // 일지는 이미 저장됨: 사진만 실패했다고 알린다
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
          <p className="text-xs text-slate-400">{editing ? "항해 일지 고치기" : "항해 일지"}</p>
          <h2 className="truncate text-lg font-black">{spot.name}</h2>
        </>
      }
      footer={
        <Button
          onClick={submit}
          disabled={busy || (guardLevel === null && gateStatus === null && !note.trim() && !hasPhoto)}
          className="w-full"
        >
          {busy ? "기록 중…" : editing ? "고친 내용 저장" : "일지 남기기"}
        </Button>
      }
    >
      {editing && (
        <p className="mb-3 rounded-xl bg-sea-800 px-3 py-2 text-xs text-slate-300">
          고쳐도 금화·현상금은 다시 받지 않고, 마지막 확인 시각도 그대로예요. 일지에 &ldquo;고침&rdquo; 표시가 붙어요.
        </p>
      )}
      {!editing && weather === "storm" && (
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
        {!editing && guardLevel === 5 && (
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
        {!editing && spot.bounty > 0 && (
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
        {keptPhotoId ? (
          <div className="relative h-32 w-32 overflow-hidden rounded-xl bg-sea-800">
            {/* eslint-disable-next-line @next/next/no-img-element -- 로그인 쿠키가 필요한 API 사진 */}
            <img src={photoUrl(keptPhotoId)} alt="붙어 있는 사진" className="h-full w-full object-cover" />
            <button
              onClick={() => setKeptPhotoId(null)}
              className="absolute top-1 right-1 h-8 w-8 rounded-full bg-black/70 text-lg"
              aria-label="사진 빼기"
            >
              ×
            </button>
          </div>
        ) : (
          <PhotoPicker file={photo} onChange={setPhoto} />
        )}
      </section>

      <div className="mt-3 pb-1">
        <ErrorText>{error}</ErrorText>
      </div>
      {editing && onDelete && (
        <button
          onClick={onDelete}
          disabled={busy}
          className="mt-2 mb-1 min-h-11 w-full rounded-xl border border-red-500/60 text-sm font-bold text-red-400"
        >
          🗑 이 일지 지우기
        </button>
      )}
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
