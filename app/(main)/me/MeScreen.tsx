"use client";

import { useCallback, useEffect, useState } from "react";
import DuelPanel from "@/components/DuelPanel";
import { useConfirm, useToast } from "@/components/feedback";
import InstallGuide from "@/components/InstallGuide";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, duration } from "@/lib/format";
import { colorOf, FLAGS, NAME_COLORS, SHOP_PRICE } from "@/lib/game";

type Me = {
  id: string;
  nickname: string;
  role: "admin" | "member";
  createdAt: string;
  flag: string;
  nameColor: string | null;
};
type Invite = { code: string; expiresAt: string; usedAt: string | null; usedBy: string | null };
type History = { id: string; spotName: string; startedAt: string; endedAt: string | null };
type Badge = { id: string; icon: string; name: string; desc: string; earned: boolean; progress: string };
type MeResponse = {
  user: Me;
  history: History[];
  doubloons: { total: number; month: number; logs: { id: string; amount: number; reason: string; createdAt: string }[] };
  title: string;
  nextTitle: { title: string; need: number } | null;
  discoveries: number;
  lordships: number;
  isKing: boolean;
  badges: Badge[];
  anniversaries: { label: string; reward: number }[];
};

type Tab = "badges" | "shop" | "duel" | "invite" | "log";
const TABS: [Tab, string][] = [
  ["badges", "🎖️ 배지"],
  ["shop", "🛒 상점"],
  ["duel", "⚔️ 결투"],
  ["invite", "🎫 승선권"],
  ["log", "📒 기록"],
];

const REASON_LABEL: Record<string, string> = {
  discovery: "정박지 발견",
  new_cell: "새 해역 개척",
  report: "항해 일지",
  parking: "정박",
  bounty: "현상금 획득",
  fleet: "함대 집결",
  lineage: "데려온 선원의 활약",
  lineage_ban: "데려온 선원 추방",
  toll: "영주 통행세",
  treasure: "오늘의 보물상자",
  stash_hide: "보물 묻기",
  stash_found: "묻힌 보물 발견",
  bounty_post: "현상금 걸기",
  shop: "상점 구매",
  duel_stake: "결투 판돈",
  duel_win: "결투 승리",
  duel_refund: "결투 환불",
  anniversary: "승선 기념일",
};

export default function MeScreen() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [tab, setTab] = useState<Tab>("badges");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const [toastNode, showToast] = useToast("bottom-24");
  const [confirmNode, confirm] = useConfirm();

  const load = useCallback(
    () =>
      Promise.all([api<MeResponse>("/api/me"), api<{ invites: Invite[] }>("/api/invites")])
        .then(([m, i]) => {
          setData(m);
          setInvites(i.invites);
          if (m.anniversaries.length) {
            showToast(m.anniversaries.map((a) => `🎉 ${a.label} 축하해요! +${a.reward}💰`).join("\n"), 6000);
          }
        })
        .catch((e: Error) => setError(e.message)),
    [showToast],
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
      showToast("🎫 승선권 링크를 복사했어요");
    } catch {
      prompt("아래 링크를 복사해서 보내 주세요.", url);
    }
  }

  async function buy(item: "flag" | "color", value: string, label: string) {
    const price = SHOP_PRICE[item];
    const ok = await confirm({
      title: "🛒 구매할까요?",
      message: `${label}\n💰 ${price}두블룬 (보유 ${data?.doubloons.total ?? 0})`,
      confirmLabel: "구매",
    });
    if (!ok) return;
    try {
      await api("/api/shop", { method: "POST", json: { item, value } });
      showToast("🛒 구매 완료!");
      await load();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function logout() {
    const ok = await confirm({ title: "하선할까요?", message: "로그아웃합니다.", confirmLabel: "하선" });
    if (!ok) return;
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  const me = data?.user;
  const balance = data?.doubloons.total ?? 0;

  return (
    <div className="pb-8">
      {toastNode}
      {confirmNode}
      <PageHeader
        title="내 정보"
        right={
          <button onClick={logout} className="h-10 px-1 text-sm text-slate-400">
            하선
          </button>
        }
      />
      <div className="space-y-4 px-5">
        <ErrorText>{error}</ErrorText>
        {!data && !error && <div className="h-44 animate-pulse rounded-2xl bg-sea-800" />}

        {me && data && (
          <section className="rounded-2xl bg-sea-800 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sea-900 text-3xl">
                {me.flag}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gold-400">
                  {data.title}
                  {data.lordships > 0 && ` · 🏰 영주 ${data.lordships}곳`}
                </div>
                <div className="truncate text-2xl font-black" style={{ color: colorOf(me.nameColor) }}>
                  {data.isKing && "👑 "}
                  {me.nickname}
                </div>
                <div className="text-xs text-slate-400">
                  {me.role === "admin" ? "🏴‍☠️ 선단장" : "선원"} · {new Date(me.createdAt).toLocaleDateString("ko-KR")} 승선
                  {" · "}
                  {Math.floor((now - new Date(me.createdAt).getTime()) / 86400_000) + 1}일째
                </div>
              </div>
            </div>
            {data.isKing && (
              <div className="mt-3 rounded-xl bg-gold-400/15 px-3 py-2 text-sm font-bold text-gold-400">
                👑 이달의 해적왕입니다!
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-sea-900 py-2">
                <div className="text-xs text-slate-400">보유 두블룬</div>
                <div className="text-xl font-black text-gold-400">💰 {balance}</div>
              </div>
              <div className="rounded-xl bg-sea-900 py-2">
                <div className="text-xs text-slate-400">이번 달 번 금화</div>
                <div className="text-xl font-black">
                  {data.doubloons.month >= 0 ? "+" : ""}
                  {data.doubloons.month}
                </div>
              </div>
            </div>
            {data.nextTitle && (
              <p className="mt-2 text-xs text-slate-400">
                정박지 {data.nextTitle.need}곳을 더 발견하면 &lsquo;{data.nextTitle.title}&rsquo; 칭호
              </p>
            )}
          </section>
        )}

        {/* 탭: 가로 스크롤 */}
        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
          <div className="flex w-max gap-1.5">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`h-10 rounded-full px-4 text-sm font-bold whitespace-nowrap ${
                  tab === k ? "bg-gold-400 text-sea-950" : "bg-sea-800 text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "badges" && data && (
          <section>
            <p className="mb-2 text-sm text-slate-400">
              {data.badges.filter((b) => b.earned).length}/{data.badges.length}개 획득 · 눌러서 얻는 법 보기
            </p>
            <ul className="grid grid-cols-4 gap-2">
              {data.badges.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => showToast(`${b.icon} ${b.name}\n${b.desc}${b.earned ? "\n✅ 획득!" : `\n진행 ${b.progress}`}`)}
                    className={`flex w-full flex-col items-center rounded-xl bg-sea-800 px-1 py-2 text-center ${
                      b.earned ? "ring-1 ring-gold-400/50" : "opacity-45 grayscale"
                    }`}
                  >
                    <span className="text-2xl">{b.icon}</span>
                    <span className="mt-1 text-[11px] leading-tight font-bold">{b.name}</span>
                    <span className="text-[10px] text-slate-400">{b.earned ? "획득" : b.progress}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "shop" && me && (
          <section className="space-y-5">
            <div>
              <h2 className="mb-1 font-bold">🏴 내 깃발 · 💰{SHOP_PRICE.flag}</h2>
              <p className="mb-2 text-xs text-slate-400">내 닉네임 앞과, 내가 영주인 정박지 핀에 꽂혀요.</p>
              <div className="grid grid-cols-6 gap-2">
                {FLAGS.map((f) => (
                  <button
                    key={f}
                    onClick={() => f !== me.flag && buy("flag", f, `깃발 ${f}`)}
                    className={`flex aspect-square items-center justify-center rounded-xl text-2xl ${
                      f === me.flag ? "bg-gold-400/20 ring-2 ring-gold-400" : `bg-sea-800 active:bg-sea-700 ${balance < SHOP_PRICE.flag ? "opacity-40" : ""}`
                    }`}
                    aria-label={`깃발 ${f}${f === me.flag ? " (사용 중)" : ""}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-1 font-bold">🎨 닉네임 색 · 💰{SHOP_PRICE.color}</h2>
              <p className="mb-2 text-xs text-slate-400">선원 명부와 랭킹에서 내 이름이 이 색으로 보여요.</p>
              <div className="grid grid-cols-3 gap-2">
                {NAME_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => c.id !== me.nameColor && buy("color", c.id, `닉네임 색 ${c.label}`)}
                    className={`h-12 rounded-xl text-sm font-black ${
                      c.id === me.nameColor ? "bg-sea-700 ring-2 ring-gold-400" : `bg-sea-800 active:bg-sea-700 ${balance < SHOP_PRICE.color ? "opacity-40" : ""}`
                    }`}
                    style={{ color: c.color }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="rounded-xl bg-sea-800 px-3 py-2 text-xs text-slate-300">
              💡 현상금 걸기와 보물 묻기는 지도에서 정박지를 눌러서 할 수 있어요.
            </p>
          </section>
        )}

        {tab === "duel" && <DuelPanel onChanged={(m) => (showToast(m), void load())} />}

        {tab === "invite" && (
          <section>
            <p className="mb-2 text-xs text-slate-400">
              미사용 최대 2장 · 7일간 유효. 데려온 선원이 금화를 벌면 10%가 나에게 와요(추방되면 −100).
            </p>
            <ul className="mb-2 space-y-2">
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
        )}

        {tab === "log" && data && (
          <section className="space-y-5">
            <div>
              <h2 className="mb-2 font-bold">📒 금화 장부</h2>
              {data.doubloons.logs.length === 0 ? (
                <p className="text-sm text-slate-500">아직 기록이 없어요.</p>
              ) : (
                <ul className="divide-y divide-sea-700 rounded-xl bg-sea-800">
                  {data.doubloons.logs.map((l) => (
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
              )}
            </div>
            <div>
              <h2 className="mb-2 font-bold">⚓ 내 정박 기록</h2>
              {data.history.length === 0 ? (
                <p className="text-sm text-slate-500">아직 정박 기록이 없어요.</p>
              ) : (
                <ul className="divide-y divide-sea-700 rounded-xl bg-sea-800">
                  {data.history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{h.spotName}</div>
                        <div className="text-xs text-slate-400">{dateTime(h.startedAt)}</div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-300">
                        {h.endedAt ? duration(h.startedAt, new Date(h.endedAt)) : <span className="text-gold-400">정박 중</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <InstallGuide />
      </div>
    </div>
  );
}
