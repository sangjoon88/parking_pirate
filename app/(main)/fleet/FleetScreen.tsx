"use client";

import { useCallback, useEffect, useState } from "react";
import BattleReplay from "@/components/BattleReplay";
import { useConfirm, useToast } from "@/components/feedback";
import Nickname from "@/components/Nickname";
import PageHeader from "@/components/PageHeader";
import { Button, ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { BattleView, CrewView, FleetState, RivalView } from "@/lib/fleetTypes";
import { ITEMS, NAVAL, NPCS, npcName, repairCost, SHIPS, shipOf, type ItemDef } from "@/lib/naval";
import { shipSvg } from "@/lib/shipSprites";

type Tab = "sea" | "yard" | "npc" | "log";
const TABS: [Tab, string][] = [
  ["sea", "⚔️ 바다"],
  ["yard", "🛠 조선소"],
  ["npc", "👥 선원"],
  ["log", "📜 전투 기록"],
];

const until = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function FleetScreen() {
  const [state, setState] = useState<FleetState | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("sea");
  const [busy, setBusy] = useState(false);
  const [replay, setReplay] = useState<BattleView | null>(null);
  const [toastNode, showToast] = useToast("bottom-24");
  const [confirmNode, confirm] = useConfirm();

  const load = useCallback(
    () =>
      api<FleetState>("/api/fleet")
        .then(setState)
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function buy(json: Record<string, unknown>, title: string, message: string) {
    const ok = await confirm({ title, message: `${message}\n💰 보유 ${state?.me.balance ?? 0}`, confirmLabel: "구매" });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api<{ message: string; state: FleetState }>("/api/fleet/buy", { method: "POST", json });
      setState(res.state);
      showToast(res.message);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function attack(r: RivalView) {
    const ok = await confirm({
      title: r.attack.independence ? `🗽 ${r.name}에 독립 전쟁!` : `⚔️ ${r.name}을(를) 공격할까요?`,
      message: r.attack.independence
        ? "이기면 바로 독립하고 그동안 낸 상납금을 돌려받아요. 지면 그대로 휘하예요."
        : `이기면 ${NAVAL.vassalDays}일간 휘하로 삼아 상납을 받아요. 지면 상대가 방어 보상을 받아요.\n장비는 싸우면서 일부 부서질 수 있어요. 공격하면 내 보호 기간은 끝나요.`,
      confirmLabel: r.attack.independence ? "독립 전쟁" : "포격 개시",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api<{ battle: BattleView; state: FleetState }>("/api/fleet/attack", {
        method: "POST",
        json: { targetId: r.userId },
      });
      setState(res.state);
      setReplay(res.battle);
      navigator.vibrate?.([60, 40, 60]);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const crew = state?.crew;
  const balance = state?.me.balance ?? 0;

  return (
    <div className="pb-8">
      {toastNode}
      {confirmNode}
      {replay && state && <BattleReplay battle={replay} myId={state.me.id} onClose={() => setReplay(null)} />}
      <PageHeader title="해적단" right={state && <span className="text-sm font-bold text-gold-400">💰 {balance}</span>} />
      <div className="space-y-4 px-5">
        <ErrorText>{error}</ErrorText>
        {!state && !error && <div className="h-56 animate-pulse rounded-2xl bg-sea-800" />}
        {state && !crew && <FoundCrew onDone={setState} />}

        {crew && (
          <>
            <CrewCard crew={crew} balance={balance} busy={busy} onRepair={() => buy({ kind: "repair" }, "🔧 수리할까요?", `체력을 ${crew.stats.maxHp}까지 채워요.\n💰 ${repairCost(crew.hp, crew.stats.maxHp)}두블룬`)} />

            <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
              <div className="flex w-max gap-1.5">
                {TABS.map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`h-10 px-4 text-sm font-bold whitespace-nowrap shadow-[2px_2px_0_rgba(0,0,0,.4)] ${
                      tab === k ? "bg-gold-400 text-sea-950" : "bg-sea-800 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "sea" && <SeaTab state={state!} busy={busy} onAttack={attack} />}
            {tab === "yard" && <YardTab crew={crew} balance={balance} busy={busy} onBuy={buy} />}
            {tab === "npc" && <NpcTab crew={crew} balance={balance} busy={busy} onBuy={buy} />}
            {tab === "log" && <LogTab battles={state!.battles} myId={state!.me.id} onOpen={setReplay} />}
          </>
        )}

        <Rules />
      </div>
    </div>
  );
}

function FoundCrew({ onDone }: { onDone: (s: FleetState) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="border-4 border-[#2b1d0e] bg-[#f4ead2] p-4 text-[#2b1d0e] shadow-[4px_4px_0_rgba(0,0,0,.5)]">
      <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: shipSvg(0, 5) }} />
      <h2 className="mt-2 text-center text-lg font-black">나만의 해적단을 세우세요</h2>
      <p className="mt-1 text-center text-sm">
        계보와 상관없이 선원 한 명이 하나의 해적단이에요. 돛단배 한 척으로 시작해 금화로 배와 무기를 키우고, 다른
        해적단과 해전을 벌여요.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, NAVAL.nameMax))}
        placeholder="해적단 이름 (예: 검은수염)"
        className="mt-3 h-12 w-full border-2 border-[#2b1d0e] bg-white px-3 text-[#2b1d0e] outline-none"
      />
      <p className="mt-1 text-xs">NPC 선원은 &ldquo;{name.trim() || "해적단명"} 요리사&rdquo;처럼 이름이 붙어요. 이름은 바꿀 수 없어요.</p>
      <ErrorText>{error}</ErrorText>
      <Button
        className="mt-3 w-full rounded-none shadow-[3px_3px_0_rgba(0,0,0,.5)]"
        disabled={busy || name.trim().length < NAVAL.nameMin}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            onDone(await api<FleetState>("/api/fleet", { method: "POST", json: { name } }));
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        🏴‍☠️ 해적단 창단 (무료)
      </Button>
    </section>
  );
}

function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.round((hp / max) * 100);
  const color = pct > 50 ? "#22c55e" : pct > 25 ? "#eab308" : "#dc2626";
  return (
    <div className="h-4 w-full border-2 border-[#0b1220] bg-[#0b1220]">
      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function CrewCard({ crew, balance, busy, onRepair }: { crew: CrewView; balance: number; busy: boolean; onRepair: () => void }) {
  const ship = shipOf(crew.shipTier);
  const cost = repairCost(crew.hp, crew.stats.maxHp);
  return (
    <section className="border-2 border-sea-600 bg-sea-800 p-4 shadow-[4px_4px_0_rgba(0,0,0,.45)]">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{crew.flag}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black">{crew.name}</div>
          <div className="text-xs text-slate-400">
            {crew.title} · 선장 <Nickname name={crew.nickname} color={crew.nameColor} effect={crew.nameEffect} /> · {crew.wins}승 {crew.losses}패
          </div>
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden border-2 border-[#0b1220] bg-gradient-to-b from-[#7dd3fc] to-[#1e40af]">
        <div className="pp-bob-ship flex justify-center pt-4" dangerouslySetInnerHTML={{ __html: shipSvg(crew.shipTier, 6) }} />
        <div className="h-2 bg-[repeating-linear-gradient(90deg,#bfdbfe_0_6px,transparent_6px_12px)] opacity-70" />
        <span className="pixel-tag absolute top-2 left-2 bg-[#f4ead2] text-[#2b1d0e]">{ship.name}</span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-bold">❤️ 체력 {crew.hp}/{crew.stats.maxHp}</span>
          <span className="text-slate-400">시간당 +{crew.stats.regenPerHour}</span>
        </div>
        <HpBar hp={crew.hp} max={crew.stats.maxHp} />
        {cost > 0 && (
          <button
            onClick={onRepair}
            disabled={busy || balance < cost}
            className="mt-2 h-9 w-full bg-sea-700 text-xs font-bold disabled:opacity-40"
          >
            🔧 바로 수리 · 💰{cost}
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="⚔️ 공격" value={crew.stats.atk} />
        <Stat label="🛡 방어" value={crew.stats.def} />
        <Stat label="⭐ 전투력" value={crew.stats.power} gold />
      </div>

      {crew.overlord && (
        <div className="mt-3 border-2 border-red-500/60 bg-red-950/40 px-3 py-2 text-sm">
          ⛓ <b>{crew.overlord.name}</b> 휘하 · {until(crew.overlord.until)}까지
          <div className="text-xs text-slate-300">
            버는 금화의 {crew.overlord.rate}% 상납 (낸 상납 {crew.overlord.paid}/{NAVAL.tributeCap}). 바다 탭에서 독립 전쟁을 걸 수 있어요.
          </div>
        </div>
      )}
      {crew.vassals.length > 0 && (
        <div className="mt-3 border-2 border-gold-400/60 bg-gold-400/10 px-3 py-2 text-sm">
          👑 휘하 해적단: {crew.vassals.map((v) => `${v.name}(${until(v.until)}까지)`).join(", ")}
        </div>
      )}
      {crew.protectedUntil && !crew.overlord && (
        <p className="mt-2 text-xs text-sky-300">🛡 {until(crew.protectedUntil)}까지 보호 중 (먼저 공격하면 풀려요)</p>
      )}
    </section>
  );
}

function Stat({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div className="bg-sea-900 py-2 shadow-[2px_2px_0_rgba(0,0,0,.4)]">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`font-mono text-lg font-black ${gold ? "text-gold-400" : ""}`}>{value}</div>
    </div>
  );
}

function SeaTab({ state, busy, onAttack }: { state: FleetState; busy: boolean; onAttack: (r: RivalView) => void }) {
  const myPower = state.crew?.stats.power ?? 0;
  return (
    <section>
      <p className="mb-2 text-xs text-slate-400">
        일반 공격은 하루 {NAVAL.raidsPerDay}번 (오늘 {state.raidsLeft}번 남음), 같은 상대는 {NAVAL.sameTargetDays}일에 한 번.
        나보다 훨씬 약한 상대를 이기면 상납이 {NAVAL.tributeRateBully}%로 줄고, 강한 상대를 이기면 {NAVAL.tributeRateUnderdog}%로 늘어요.
      </p>
      {state.rivals.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">아직 다른 해적단이 없어요. 선원들에게 창단을 권해 보세요!</p>
      ) : (
        <ul className="space-y-2">
          {state.rivals.map((r) => {
            const ratio = myPower ? r.power / myPower : 1;
            const danger = ratio >= 1.5 ? "text-red-400" : ratio <= 0.5 ? "text-slate-500" : "text-slate-300";
            return (
              <li key={r.userId} className="flex items-center gap-3 bg-sea-800 px-3 py-2 shadow-[2px_2px_0_rgba(0,0,0,.4)]">
                <div className="w-16 shrink-0" dangerouslySetInnerHTML={{ __html: shipSvg(r.shipTier, 3, true) }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">
                    {r.flag} {r.name}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    <Nickname name={r.nickname} color={r.nameColor} effect={r.nameEffect} /> · {r.title} · {r.wins}승 {r.losses}패
                  </div>
                  <div className="text-[11px]">
                    <span className={danger}>⭐{r.power}</span> · ❤️{r.hpPct}%
                    {r.overlordName && <span className="text-red-400"> · ⛓{r.overlordName} 휘하</span>}
                  </div>
                </div>
                {r.attack.ok ? (
                  <button
                    onClick={() => onAttack(r)}
                    disabled={busy}
                    className={`h-11 shrink-0 px-3 text-sm font-black shadow-[2px_2px_0_rgba(0,0,0,.5)] disabled:opacity-40 ${
                      r.attack.independence ? "bg-sky-400 text-sea-950" : "bg-red-600 text-white"
                    }`}
                  >
                    {r.attack.independence ? "🗽 독립" : "⚔️ 공격"}
                  </button>
                ) : (
                  <span className="w-16 shrink-0 text-center text-[11px] leading-tight text-slate-500">{r.attack.reason}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type BuyFn = (json: Record<string, unknown>, title: string, message: string) => void;

function YardTab({ crew, balance, busy, onBuy }: { crew: CrewView; balance: number; busy: boolean; onBuy: BuyFn }) {
  const next = SHIPS[crew.shipTier + 1];
  const ship = shipOf(crew.shipTier);
  return (
    <section className="space-y-5">
      <div>
        <h2 className="mb-2 font-bold">⛵ 배 업그레이드</h2>
        {next ? (
          <div className="flex items-center gap-3 bg-sea-800 p-3 shadow-[2px_2px_0_rgba(0,0,0,.4)]">
            <div className="w-20 shrink-0" dangerouslySetInnerHTML={{ __html: shipSvg(next.tier, 4) }} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-black">{next.name}</div>
              <div className="text-xs text-slate-400">{next.desc}</div>
              <div className="text-xs">
                ❤️{ship.hp}→{next.hp} · ⚔️{ship.atk}→{next.atk} · 🛡{ship.def}→{next.def}
              </div>
              <div className="text-xs">
                무기 칸 {ship.weaponSlots}→{next.weaponSlots} · 방어 칸 {ship.armorSlots}→{next.armorSlots}
              </div>
            </div>
            <button
              disabled={busy || balance < next.price}
              onClick={() => onBuy({ kind: "ship" }, `⛵ ${next.name}(으)로 갈아탈까요?`, `💰 ${next.price}두블룬`)}
              className="h-11 shrink-0 bg-gold-400 px-3 text-sm font-black text-sea-950 shadow-[2px_2px_0_rgba(0,0,0,.5)] disabled:opacity-40"
            >
              💰{next.price}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gold-400">👻 최고의 배, {ship.name}을(를) 타고 있어요.</p>
        )}
      </div>
      <ItemList kind="weapon" title="⚔️ 무기" note={`무기 칸 ${ship.weaponSlots}개: 강한 것부터 자동 장착`} crew={crew} balance={balance} busy={busy} onBuy={onBuy} />
      <ItemList kind="armor" title="🛡 방어구" note={`방어 칸 ${ship.armorSlots}개: 강한 것부터 자동 장착`} crew={crew} balance={balance} busy={busy} onBuy={onBuy} />
      <p className="bg-sea-800 px-3 py-2 text-xs text-slate-300">
        💡 장비는 소모품이에요. 해전 뒤 이긴 쪽은 {NAVAL.breakWinner}%, 진 쪽은 {NAVAL.breakLoser}% 확률로 장착한 장비가 하나씩 부서져요 (목수가 줄여 줘요).
      </p>
    </section>
  );
}

function ItemList({
  kind,
  title,
  note,
  crew,
  balance,
  busy,
  onBuy,
}: {
  kind: ItemDef["kind"];
  title: string;
  note: string;
  crew: CrewView;
  balance: number;
  busy: boolean;
  onBuy: BuyFn;
}) {
  const equipped = new Map(crew.stats.equipped.map((e) => [e.id, e.count]));
  return (
    <div>
      <h2 className="font-bold">{title}</h2>
      <p className="mb-2 text-xs text-slate-400">{note}</p>
      <ul className="space-y-1.5">
        {ITEMS.filter((i) => i.kind === kind).map((it) => {
          const have = crew.loadout.items[it.id] ?? 0;
          const on = equipped.get(it.id) ?? 0;
          return (
            <li key={it.id} className="flex items-center gap-2 bg-sea-800 px-3 py-2 shadow-[2px_2px_0_rgba(0,0,0,.4)]">
              <span className="text-2xl">{it.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">
                  {it.name} <span className="font-mono text-xs text-slate-400">{kind === "weapon" ? "⚔️" : "🛡"}+{it.power}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  보유 {have}
                  {on > 0 && <span className="text-gold-400"> · 장착 {on}</span>}
                </div>
              </div>
              {[1, 3].map((q) => (
                <button
                  key={q}
                  disabled={busy || balance < it.price * q}
                  onClick={() => onBuy({ kind: "item", id: it.id, qty: q }, `${it.icon} ${it.name} ${q}개`, `💰 ${it.price * q}두블룬`)}
                  className="h-10 shrink-0 bg-sea-700 px-2 text-xs font-bold disabled:opacity-40"
                >
                  {q > 1 ? `×${q} ` : ""}💰{it.price * q}
                </button>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NpcTab({ crew, balance, busy, onBuy }: { crew: CrewView; balance: number; busy: boolean; onBuy: BuyFn }) {
  return (
    <section>
      <p className="mb-2 text-xs text-slate-400">사람이 아닌 우리 해적단 전용 NPC예요. 레벨을 올리면 효과가 커져요.</p>
      <ul className="space-y-2">
        {NPCS.map((n) => {
          const lv = crew.loadout.npcs[n.role] ?? 0;
          const max = lv >= n.maxLevel;
          const price = n.prices[lv];
          return (
            <li key={n.role} className="flex items-center gap-3 bg-sea-800 px-3 py-2.5 shadow-[2px_2px_0_rgba(0,0,0,.4)]">
              <span className={`text-3xl ${lv ? "" : "opacity-40 grayscale"}`}>{n.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black">
                  {npcName(crew.name, n.role)}
                  {lv > 0 && <span className="ml-1 font-mono text-xs text-gold-400">Lv.{lv}</span>}
                </div>
                <div className="text-[11px] text-slate-400">
                  {lv ? n.effect(lv) : "아직 없음"}
                  {!max && lv > 0 && <span> → {n.effect(lv + 1)}</span>}
                  {!lv && <span> · 고용하면 {n.effect(1)}</span>}
                </div>
              </div>
              {max ? (
                <span className="pixel-tag shrink-0 bg-gold-400 text-sea-950">MAX</span>
              ) : (
                <button
                  disabled={busy || balance < price}
                  onClick={() =>
                    onBuy(
                      { kind: "npc", role: n.role },
                      lv ? `${n.icon} ${npcName(crew.name, n.role)} Lv.${lv + 1}` : `${n.icon} ${npcName(crew.name, n.role)} 고용`,
                      `${n.effect(lv + 1)}\n💰 ${price}두블룬`,
                    )
                  }
                  className="h-11 shrink-0 bg-gold-400 px-3 text-xs font-black text-sea-950 shadow-[2px_2px_0_rgba(0,0,0,.5)] disabled:opacity-40"
                >
                  {lv ? "레벨업" : "고용"}
                  <br />💰{price}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LogTab({ battles, myId, onOpen }: { battles: BattleView[]; myId: string; onOpen: (b: BattleView) => void }) {
  if (battles.length === 0) return <p className="py-6 text-center text-sm text-slate-500">아직 해전 기록이 없어요.</p>;
  return (
    <ul className="space-y-2">
      {battles.map((b) => {
        const { log } = b;
        const iAmA = log.a.userId === myId;
        const won = iAmA ? log.attackerWon : !log.attackerWon;
        const other = iAmA ? log.d : log.a;
        return (
          <li key={b.id}>
            <button
              onClick={() => onOpen(b)}
              className="flex w-full items-center gap-3 bg-sea-800 px-3 py-2.5 text-left shadow-[2px_2px_0_rgba(0,0,0,.4)] active:bg-sea-700"
            >
              <span className={`pixel-tag shrink-0 ${won ? "bg-gold-400 text-sea-950" : "bg-slate-600 text-white"}`}>{won ? "WIN" : "LOSE"}</span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-bold">
                  {log.independence ? "🗽 " : iAmA ? "⚔️ " : "🛡 "}
                  {other.flag} {other.name}
                  {iAmA ? " 공격" : "의 공격"}
                </div>
                <div className="text-[11px] text-slate-400">{timeAgo(b.createdAt)} · 눌러서 다시 보기</div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Rules() {
  return (
    <details className="bg-sea-800 px-3 py-2 text-xs text-slate-300">
      <summary className="cursor-pointer py-1 text-sm font-bold text-slate-200">📖 해전 규칙</summary>
      <ul className="mt-1 space-y-1 pb-1">
        <li>· 배 체력·공격·방어로 서로 한 발씩 쏘는 자동 포격전이에요. 운(명중·치명타)도 있어요.</li>
        <li>· 공격해서 이기면 상대가 {NAVAL.vassalDays}일간 휘하가 되어, 활동으로 버는 금화의 {NAVAL.tributeRate}%를 상납해요 (휘하 1회 최대 {NAVAL.tributeCap}).</li>
        <li>· 내 전투력의 절반도 안 되는 상대를 이기면 상납 {NAVAL.tributeRateBully}%·전리품 {NAVAL.lootBully}, 1.5배 강한 상대를 이기면 상납 {NAVAL.tributeRateUnderdog}%·전리품 {NAVAL.lootUnderdog}.</li>
        <li>· 휘하는 언제든 주인에게 🗽 독립 전쟁을 걸 수 있어요. 이기면 바로 독립하고 낸 상납금을 돌려받아요.</li>
        <li>· 휘하인 동안, 풀린 뒤 {NAVAL.freedProtectDays}일, 창단 후 {NAVAL.newCrewProtectDays}일은 다른 해적단이 공격할 수 없어요.</li>
        <li>· 체력이 {NAVAL.minAttackHpPct}% 미만이면 공격할 수 없어요. 시간이 지나면 회복되고, 금화로 바로 수리할 수도 있어요.</li>
        <li>· 해전은 정박 결투(내 정보 탭)와 별개예요. 정박 결투는 정박 횟수, 해전은 함선 실력으로 겨뤄요.</li>
      </ul>
    </details>
  );
}
