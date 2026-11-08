"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { NOTE_MAX } from "@/lib/constants";
import { GUARD_LABELS, guardColor } from "@/lib/format";
import type { SpotSummary } from "@/lib/types";
import Sheet from "./Sheet";
import { Button, ErrorText } from "./ui";

export default function ReportSheet({
  spot,
  onClose,
  onDone,
}: {
  spot: SpotSummary;
  onClose: () => void;
  onDone: (closed: boolean) => void;
}) {
  const [guardLevel, setGuardLevel] = useState<number | null>(null);
  const [gateStatus, setGateStatus] = useState<"no_gate" | "gate_installed" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ closed: boolean }>("/api/reports", {
        method: "POST",
        json: { spotId: spot.id, guardLevel, gateStatus, note },
      });
      onDone(res.closed);
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
    >
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

      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
      <Button onClick={submit} disabled={busy || (guardLevel === null && gateStatus === null && !note.trim())} className="mt-3 w-full">
        {busy ? "기록 중…" : "일지 남기기"}
      </Button>
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
