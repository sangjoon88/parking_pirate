"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AmountSheet, useConfirm, useToast } from "@/components/feedback";
import PageHeader from "@/components/PageHeader";
import { ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import { colorOf, DUEL_DAYS, DUEL_STAKES, REWARD } from "@/lib/game";
import type { SpotSummary } from "@/lib/types";
import { exploredCells, YEOUIDO_CELLS } from "@/lib/yeouido";

type Member = {
  id: string;
  nickname: string;
  referrerId: string | null;
  role: "admin" | "member";
  status: "active" | "banned";
  createdAt: string;
  title: string;
  doubloons: number;
  isKing: boolean;
  flag: string;
  nameColor: string | null;
};

type Entry = { userId: string; nickname: string; score: number };
type Rankings = { gold: Entry[]; discover: Entry[]; scout: Entry[]; regular: Entry[] };
type Tab = "tree" | "rank" | "chart";

export default function CrewScreen() {
  const [tab, setTab] = useState<Tab>("tree");
  const [crew, setCrew] = useState<Member[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [spots, setSpots] = useState<SpotSummary[] | null>(null);
  const [error, setError] = useState("");
  const [duelTarget, setDuelTarget] = useState<Member | null>(null);
  const [toastNode, showToast] = useToast();
  const [confirmNode, confirm] = useConfirm();

  const load = useCallback(
    () =>
      Promise.all([
        api<{ me: { id: string; role: string }; crew: Member[] }>("/api/crew"),
        api<Rankings>("/api/rankings"),
        api<{ spots: SpotSummary[] }>("/api/spots"),
      ])
        .then(([c, r, s]) => {
          setCrew(c.crew);
          setMe(c.me);
          setRankings(r);
          setSpots(s.spots);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const { roots, children } = useMemo(() => {
    const children = new Map<string, Member[]>();
    const ids = new Set(crew.map((c) => c.id));
    const roots: Member[] = [];
    for (const c of crew) {
      if (c.referrerId && ids.has(c.referrerId)) {
        const list = children.get(c.referrerId) ?? [];
        list.push(c);
        children.set(c.referrerId, list);
      } else {
        roots.push(c);
      }
    }
    return { roots, children };
  }, [crew]);

  async function ban(m: Member) {
    const ok = await confirm({
      title: `${m.nickname}님을 추방할까요?`,
      message: `미사용 승선권은 무효가 되고, 추천인은 ${-REWARD.banPenalty}두블룬이 깎여요. 되돌릴 수 없어요.`,
      confirmLabel: "추방",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/crew/${m.id}/ban`, { method: "POST" });
      showToast(`${m.nickname}님을 추방했어요`);
      await load();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  const active = crew.filter((c) => c.status === "active").length;
  const kingIds = new Set(crew.filter((c) => c.isKing).map((c) => c.id));
  const colors = new Map(crew.map((c) => [c.id, colorOf(c.nameColor)]));
  const myGold = crew.find((c) => c.id === me?.id)?.doubloons ?? null;

  return (
    <div className="pb-8">
      {toastNode}
      {confirmNode}
      {duelTarget && (
        <AmountSheet
          title={`⚔️ ${duelTarget.nickname}님에게 결투 신청`}
          description={`${DUEL_DAYS}일 동안 정박을 더 많이 한 쪽이 판돈 2배를 가져가요. 비기면 돌려받고, 상대가 2일 안에 응답하지 않으면 환불돼요.`}
          options={DUEL_STAKES}
          balance={myGold}
          confirmLabel="결투 신청"
          onClose={() => setDuelTarget(null)}
          onSubmit={async (stake) => {
            await api("/api/duels", { method: "POST", json: { opponentId: duelTarget.id, stake } });
            setDuelTarget(null);
            showToast(`⚔️ ${duelTarget.nickname}님에게 결투를 신청했어요`);
            await load();
          }}
        />
      )}
      <PageHeader title="선원 명부" right={<span className="text-sm text-slate-400">선원 {active}명</span>} />
      <div className="px-5">
        <div className="mb-4 grid grid-cols-3 rounded-xl bg-sea-800 p-1 text-sm font-bold">
          {(
            [
              ["tree", "선단 계보"],
              ["rank", "해적 랭킹"],
              ["chart", "여의도 해도"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`h-10 rounded-lg ${tab === k ? "bg-gold-400 text-sea-950" : "text-slate-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ErrorText>{error}</ErrorText>

        {tab === "tree" && (
          <>
            <p className="mb-3 text-xs text-slate-400">
              누가 누구를 데려왔는지 보여줘요. 데려온 선원이 금화를 벌면 추천인도 10%를 받아요.
            </p>
            <ul className="rounded-2xl bg-sea-800 px-4 py-2">
              {roots.map((r) => (
                <Node key={r.id} m={r} depth={0} ctx={{ childrenOf: children, me, onBan: ban, onDuel: setDuelTarget }} />
              ))}
            </ul>
          </>
        )}

        {tab === "rank" && rankings && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">이번 달 기록이에요. 매달 1일에 새로 시작해요.</p>
            <Board title="💰 금화왕 (이달의 해적왕)" unit="두블룬" entries={rankings.gold} kingIds={kingIds} colors={colors} highlight />
            <Board title="🚩 발견왕" unit="곳" entries={rankings.discover} kingIds={kingIds} colors={colors} />
            <Board title="🔭 정찰왕" unit="개" entries={rankings.scout} kingIds={kingIds} colors={colors} />
            <Board title="⚓ 단골 선원" unit="회" entries={rankings.regular} kingIds={kingIds} colors={colors} />
          </div>
        )}

        {tab === "chart" && spots && <ChartPanel spots={spots} />}
      </div>
    </div>
  );
}

function ChartPanel({ spots }: { spots: SpotSummary[] }) {
  const explored = exploredCells(spots);
  const total = YEOUIDO_CELLS.length;
  const pct = Math.round((explored.size / total) * 100);
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-sea-800 p-4 text-center">
        <div className="text-sm text-slate-400">선단 공동 목표</div>
        <div className="mt-1 text-4xl font-black text-gold-400">{pct}%</div>
        <div className="mt-1 text-sm">
          여의도 {total}개 해역 중 <b>{explored.size}</b>곳을 밝혔어요
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-sea-700">
          <div className="h-full bg-gold-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>
      <p className="text-sm text-slate-300">
        여의도를 약 250m 칸으로 나눴어요. 아직 아무도 정박지를 찾지 못한 칸에 새 정박지를 등록하면{" "}
        <b className="text-gold-400">+{REWARD.newCell} 두블룬</b> 보너스와 &lsquo;해도 개척자&rsquo; 배지를 받아요.
      </p>
      <Link
        href="/?fog=1"
        className="flex min-h-12 items-center justify-center rounded-xl bg-gold-400 font-bold text-sea-950"
      >
        🗺️ 지도에서 해도 보기
      </Link>
    </div>
  );
}

function Board({
  title,
  unit,
  entries,
  kingIds,
  colors,
  highlight,
}: {
  title: string;
  unit: string;
  entries: Entry[];
  kingIds: Set<string>;
  colors: Map<string, string | undefined>;
  highlight?: boolean;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <section className={`rounded-2xl p-4 ${highlight ? "border border-gold-400/40 bg-gold-400/10" : "bg-sea-800"}`}>
      <h3 className="mb-2 font-bold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">아직 기록이 없어요. 첫 번째가 되어 보세요!</p>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li key={e.userId} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-center">{medals[i] ?? i + 1}</span>
              <span className="flex-1 font-semibold" style={{ color: colors.get(e.userId) }}>
                {kingIds.has(e.userId) && "👑 "}
                {e.nickname}
              </span>
              <span className="text-slate-300">
                {e.score.toLocaleString()}
                {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

type Ctx = {
  childrenOf: Map<string, Member[]>;
  me: { id: string; role: string } | null;
  onBan: (m: Member) => void;
  onDuel: (m: Member) => void;
};

function Node({ m, depth, ctx }: { m: Member; depth: number; ctx: Ctx }) {
  const { childrenOf, me, onBan, onDuel } = ctx;
  const kids = childrenOf.get(m.id) ?? [];
  const banned = m.status === "banned";
  return (
    <li>
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 18 }}>
        {depth > 0 && <span className="text-sea-600">└</span>}
        <div className="min-w-0">
          <div
            className={`truncate font-semibold ${banned ? "text-slate-500 line-through" : ""}`}
            style={{ color: banned ? undefined : colorOf(m.nameColor) }}
          >
            {m.isKing && "👑 "}
            {m.flag}{" "}
            {m.nickname}
            {m.id === me?.id && (
              <span className="ml-1.5 rounded bg-gold-400/20 px-1.5 text-[11px] text-gold-400">나</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {banned ? <span className="text-red-400">추방됨</span> : m.title} · 💰{m.doubloons}
            {kids.length > 0 && ` · 데려온 선원 ${kids.length}`}
          </div>
        </div>
        {!banned && me && m.id !== me.id && (
          <button
            onClick={() => onDuel(m)}
            aria-label={`${m.nickname}님에게 결투 신청`}
            className="ml-auto h-9 w-9 shrink-0 rounded-lg bg-sea-700 text-base active:bg-sea-600"
          >
            ⚔️
          </button>
        )}
        {me?.role === "admin" && !banned && m.role !== "admin" && (
          <button
            onClick={() => onBan(m)}
            className="h-9 shrink-0 rounded-lg px-2 text-xs text-red-400 active:bg-red-950"
          >
            추방
          </button>
        )}
      </div>
      {kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <Node key={k.id} m={k} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}
