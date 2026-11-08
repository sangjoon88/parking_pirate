"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { DUEL_DAYS } from "@/lib/game";
import { useConfirm } from "./feedback";

type Duel = {
  id: string;
  challenger: string;
  opponent: string;
  mine: "challenger" | "opponent";
  stake: number;
  status: "pending" | "active" | "declined" | "expired" | "done";
  endsAt: string | null;
  createdAt: string;
  winnerId: string | null;
  challengerId: string;
  opponentId: string;
  challengerScore: number | null;
  opponentScore: number | null;
};

const STATUS: Record<Duel["status"], string> = {
  pending: "응답 대기",
  active: "진행 중",
  declined: "거절됨",
  expired: "만료",
  done: "끝",
};

/** 내 결투 목록 + 받은 신청 수락/거절 */
export default function DuelPanel({ onChanged }: { onChanged: (msg: string) => void }) {
  const [duels, setDuels] = useState<Duel[] | null>(null);
  const [error, setError] = useState("");
  const [confirmNode, confirm] = useConfirm();

  const load = useCallback(
    () =>
      api<{ duels: Duel[] }>("/api/duels")
        .then((d) => setDuels(d.duels))
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function respond(d: Duel, action: "accept" | "decline") {
    if (action === "accept") {
      const ok = await confirm({
        title: "⚔️ 결투를 받을까요?",
        message: `${d.challenger}님과 ${DUEL_DAYS}일 동안 정박 횟수 대결.\n판돈 ${d.stake}두블룬을 걸고, 이기면 ${d.stake * 2}두블룬을 가져가요.`,
        confirmLabel: "결투 수락",
      });
      if (!ok) return;
    }
    try {
      await api(`/api/duels/${d.id}`, { method: "POST", json: { action } });
      onChanged(action === "accept" ? "⚔️ 결투 시작! 정박을 많이 하세요" : "결투를 거절했어요");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>;
  if (!duels) return <p className="text-sm text-slate-500">불러오는 중…</p>;

  return (
    <div className="space-y-2">
      {confirmNode}
      <p className="text-xs text-slate-400">
        선원 명부에서 상대 옆 ⚔️를 눌러 신청해요. {DUEL_DAYS}일 동안 정박을 더 많이 한 쪽이 판돈 2배를 가져가고, 비기면
        돌려받아요. 신청 후 2일 안에 응답이 없으면 환불돼요.
      </p>
      {duels.length === 0 && <p className="py-4 text-center text-sm text-slate-500">아직 결투 기록이 없어요.</p>}
      {duels.map((d) => {
        const meChallenger = d.mine === "challenger";
        const other = meChallenger ? d.opponent : d.challenger;
        const myScore = meChallenger ? d.challengerScore : d.opponentScore;
        const theirScore = meChallenger ? d.opponentScore : d.challengerScore;
        const myId = meChallenger ? d.challengerId : d.opponentId;
        const won = d.status === "done" && d.winnerId === myId;
        const lost = d.status === "done" && d.winnerId && d.winnerId !== myId;
        return (
          <div key={d.id} className="rounded-xl bg-sea-800 p-3">
            <div className="flex items-center justify-between">
              <div className="font-bold">⚔️ vs {other}</div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  d.status === "active"
                    ? "bg-gold-400 text-sea-950"
                    : won
                      ? "bg-green-600"
                      : lost
                        ? "bg-red-700"
                        : "bg-sea-600"
                }`}
              >
                {won ? "승리" : lost ? "패배" : d.status === "done" ? "무승부" : STATUS[d.status]}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              판돈 💰{d.stake} · {meChallenger ? "내가 신청" : "받은 신청"}
              {d.status === "active" && d.endsAt && ` · ${dateTime(d.endsAt)}까지`}
            </div>
            {(d.status === "active" || d.status === "done") && (
              <div className="mt-2 flex items-center justify-center gap-3 text-lg font-black">
                <span className="text-gold-400">나 {myScore ?? 0}</span>
                <span className="text-sm text-slate-500">:</span>
                <span>
                  {theirScore ?? 0} {other}
                </span>
              </div>
            )}
            {d.status === "pending" && !meChallenger && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => respond(d, "decline")} className="h-10 rounded-lg bg-sea-700 text-sm font-bold">
                  거절
                </button>
                <button
                  onClick={() => respond(d, "accept")}
                  className="h-10 rounded-lg bg-gold-400 text-sm font-bold text-sea-950"
                >
                  수락 (💰{d.stake})
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
