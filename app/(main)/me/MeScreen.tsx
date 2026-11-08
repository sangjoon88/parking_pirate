"use client";

import { useCallback, useEffect, useState } from "react";
import InstallGuide from "@/components/InstallGuide";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, duration } from "@/lib/format";

type Me = { id: string; nickname: string; role: "admin" | "member"; createdAt: string };
type Invite = { code: string; expiresAt: string; usedAt: string | null; usedBy: string | null };
type History = { id: string; spotName: string; startedAt: string; endedAt: string | null };
type Badge = { id: string; icon: string; name: string; desc: string; earned: boolean; progress: string };
type GameInfo = {
  doubloons: { total: number; month: number; logs: { id: string; amount: number; reason: string; createdAt: string }[] };
  title: string;
  nextTitle: { title: string; need: number } | null;
  discoveries: number;
  isKing: boolean;
  badges: Badge[];
};

const REASON_LABEL: Record<string, string> = {
  discovery: "정박지 발견",
  new_cell: "새 해역 개척",
  report: "항해 일지",
  parking: "정박",
  bounty: "현상금",
  fleet: "함대 집결",
  lineage: "데려온 선원의 활약",
  lineage_ban: "데려온 선원 추방",
};

export default function MeScreen() {
  const [me, setMe] = useState<Me | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [now] = useState(() => Date.now());

  const load = useCallback(
    () =>
      Promise.all([
        api<{ user: Me; history: History[] } & GameInfo>("/api/me"),
        api<{ invites: Invite[] }>("/api/invites"),
      ])
        .then(([m, i]) => {
          setMe(m.user);
          setGame(m);
          setHistory(m.history);
          setInvites(i.invites);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function issue() {
    setBusy(true);
    setError("");
    try {
      await api("/api/invites", { method: "POST" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function share(code: string) {
    const url = `${location.origin}/join?code=${code}`;
    const text = `☠ 주차해적단 승선권 (7일 안에 써 주세요)\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "주차해적단 승선권", text });
        return;
      } catch {
        /* 취소하면 복사로 */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("승선권 링크를 복사했어요.");
    } catch {
      prompt("아래 링크를 복사해서 보내 주세요.", url);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="내 정보"
        right={
          <button onClick={logout} className="text-sm text-slate-400">
            하선(로그아웃)
          </button>
        }
      />
      <div className="space-y-6 px-5">
        {me && (
          <section className="rounded-2xl bg-sea-800 p-4">
            {game && <div className="text-sm font-bold text-gold-400">{game.title}</div>}
            <div className="text-2xl font-black">
              {game?.isKing && "👑 "}
              {me.nickname}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {me.role === "admin" ? "🏴‍☠️ 선단장(관리자)" : "선원"} · {new Date(me.createdAt).toLocaleDateString("ko-KR")}{" "}
              승선
            </div>
            {game?.isKing && <div className="mt-2 text-sm font-bold text-gold-400">이달의 해적왕입니다!</div>}
            {game && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-sea-900 py-2">
                  <div className="text-xs text-slate-400">보유 두블룬</div>
                  <div className="text-xl font-black text-gold-400">💰 {game.doubloons.total}</div>
                </div>
                <div className="rounded-xl bg-sea-900 py-2">
                  <div className="text-xs text-slate-400">이번 달</div>
                  <div className="text-xl font-black">+{game.doubloons.month}</div>
                </div>
              </div>
            )}
            {game?.nextTitle && (
              <p className="mt-2 text-xs text-slate-400">
                정박지 {game.nextTitle.need}곳을 더 발견하면 &lsquo;{game.nextTitle.title}&rsquo; 칭호
              </p>
            )}
          </section>
        )}

        {game && (
          <section>
            <h2 className="mb-2 font-bold">
              배지 <span className="text-sm font-normal text-slate-400">{game.badges.filter((b) => b.earned).length}/{game.badges.length}</span>
            </h2>
            <ul className="grid grid-cols-4 gap-2">
              {game.badges.map((b) => (
                <li
                  key={b.id}
                  className={`flex flex-col items-center rounded-xl bg-sea-800 px-1 py-2 text-center ${b.earned ? "" : "opacity-40 grayscale"}`}
                  title={b.desc}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="mt-1 text-[11px] leading-tight font-bold">{b.name}</span>
                  <span className="text-[10px] text-slate-400">{b.earned ? "획득" : b.progress}</span>
                </li>
              ))}
            </ul>
            <details className="mt-2 text-xs text-slate-400">
              <summary className="cursor-pointer">배지 얻는 법</summary>
              <ul className="mt-1 space-y-0.5">
                {game.badges.map((b) => (
                  <li key={b.id}>
                    {b.icon} {b.name}: {b.desc}
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {game && game.doubloons.logs.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">금화 장부</h2>
            <ul className="divide-y divide-sea-700 rounded-xl bg-sea-800">
              {game.doubloons.logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <div>{REASON_LABEL[l.reason] ?? l.reason}</div>
                    <div className="text-xs text-slate-400">{dateTime(l.createdAt)}</div>
                  </div>
                  <div className={`font-bold ${l.amount < 0 ? "text-red-400" : "text-gold-400"}`}>
                    {l.amount > 0 ? "+" : ""}
                    {l.amount}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">승선권</h2>
            <span className="text-xs text-slate-400">미사용 최대 2장 · 7일간 유효</span>
          </div>
          <ErrorText>{error}</ErrorText>
          <ul className="my-2 space-y-2">
            {invites.map((iv) => {
              const expired = !iv.usedAt && new Date(iv.expiresAt).getTime() < now;
              return (
                <li key={iv.code} className="flex items-center gap-3 rounded-xl bg-sea-800 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-mono text-lg font-bold ${iv.usedAt || expired ? "text-slate-500 line-through" : ""}`}
                    >
                      {iv.code}
                    </div>
                    <div className="text-xs text-slate-400">
                      {iv.usedAt
                        ? `${iv.usedBy ?? "?"}님 승선 (${dateTime(iv.usedAt)})`
                        : expired
                          ? "만료됨"
                          : `${dateTime(iv.expiresAt)}까지`}
                    </div>
                  </div>
                  {!iv.usedAt && !expired && (
                    <button
                      onClick={() => share(iv.code)}
                      className="h-10 rounded-lg bg-gold-400 px-3 text-sm font-bold text-sea-950"
                    >
                      보내기
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <Button onClick={issue} disabled={busy} variant="ghost" className="w-full">
            {busy ? "발급 중…" : "+ 승선권 발급"}
          </Button>
        </section>

        <section>
          <h2 className="mb-2 font-bold">내 정박 기록</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">아직 정박 기록이 없어요.</p>
          ) : (
            <ul className="divide-y divide-sea-700 rounded-xl bg-sea-800">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{h.spotName}</div>
                    <div className="text-xs text-slate-400">{dateTime(h.startedAt)}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-300">
                    {h.endedAt ? (
                      duration(h.startedAt, new Date(h.endedAt))
                    ) : (
                      <span className="text-gold-400">정박 중</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <InstallGuide />
      </div>
    </div>
  );
}
