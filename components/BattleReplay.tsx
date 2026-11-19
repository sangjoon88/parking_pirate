"use client";

import { useEffect, useState } from "react";
import type { BattleView } from "@/lib/fleetTypes";
import { itemLabel } from "@/lib/naval";
import { shipSvg } from "@/lib/shipSprites";

const STEP_MS = 650;

/**
 * 해전 다시 보기: 두 배가 마주 보고 한 발씩 포격. 체력 막대가 줄고 마지막에 결과.
 * myId 쪽에서 본 승패 문구를 보여 준다.
 */
export default function BattleReplay({ battle, myId, onClose }: { battle: BattleView; myId: string; onClose: () => void }) {
  const { log } = battle;
  const [step, setStep] = useState(0); // 지금까지 보여 준 포격 수
  const done = step >= log.shots.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, done]);

  const last = step > 0 ? log.shots[step - 1] : null;
  const hpA = last ? last.hpA : log.a.hp0;
  const hpD = last ? last.hpD : log.d.hp0;
  const iAmA = log.a.userId === myId;
  const iWon = iAmA ? log.attackerWon : !log.attackerWon;
  const involved = log.a.userId === myId || log.d.userId === myId;

  const headline = log.independence
    ? log.attackerWon
      ? `🗽 ${log.a.name} 독립 성공!`
      : `⛓ ${log.a.name}의 독립 실패`
    : log.attackerWon
      ? `☠ ${log.a.name} 승리! ${log.d.name}은(는) 1주일간 휘하로`
      : `🛡 ${log.d.name}이(가) 지켜 냈다!`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a1424]/95" onClick={() => done && onClose()}>
      <div className="safe-top px-4 pt-4 text-center">
        <p className="text-xs text-slate-400">{log.independence ? "🗽 독립 전쟁" : "⚔️ 해전"}</p>
        <h2 className="text-lg font-black">
          {log.a.flag} {log.a.name} <span className="text-slate-500">vs</span> {log.d.name} {log.d.flag}
        </h2>
      </div>

      {/* 바다 위 두 배 */}
      <div className="relative mx-4 mt-4 overflow-hidden border-4 border-[#2b1d0e] bg-gradient-to-b from-[#7dd3fc] to-[#1e40af] shadow-[4px_4px_0_rgba(0,0,0,.5)]">
        <div className="flex items-end justify-between px-3 pt-6 pb-2">
          <Side
            name={log.a.name}
            tier={log.a.shipTier}
            hp={hpA}
            max={log.a.maxHp}
            hit={!!last && last.by === "d" && last.hit}
            firing={!!last && last.by === "a"}
          />
          <Side
            name={log.d.name}
            tier={log.d.shipTier}
            hp={hpD}
            max={log.d.maxHp}
            flip
            hit={!!last && last.by === "a" && last.hit}
            firing={!!last && last.by === "d"}
          />
        </div>
        <div className="h-3 bg-[repeating-linear-gradient(90deg,#bfdbfe_0_6px,transparent_6px_12px)] opacity-70" />
      </div>

      {/* 포격 기록 */}
      <div className="mx-4 mt-3 min-h-0 flex-1 overflow-y-auto border-2 border-[#2b1d0e] bg-[#f4ead2] p-3 font-mono text-[13px] leading-5 text-[#2b1d0e]">
        {log.shots.slice(0, step).map((s, i) => {
          const who = s.by === "a" ? log.a.name : log.d.name;
          return (
            <div key={i}>
              {s.hit ? (s.crit ? "💥 치명타! " : "💣 ") : "🌊 "}
              <b>{who}</b> {s.hit ? `명중 −${s.dmg}` : "빗나감"}
              {s.taunt && <div className="pl-5 text-[#7c2d12]">🦜 {s.taunt}</div>}
            </div>
          );
        })}
        {done && (
          <div className="mt-2 border-t-2 border-dashed border-[#2b1d0e]/40 pt-2">
            <div className="font-black">{headline}</div>
            {log.loot > 0 && <div>💰 전리품 +{log.loot} ({log.a.name})</div>}
            {log.tributeRate > 0 && <div>📜 상납 {log.tributeRate}% · 1주일</div>}
            {log.defense > 0 && <div>🛡 방어 보상 +{log.defense} ({log.d.name})</div>}
            {log.refund > 0 && <div>💰 그동안 낸 상납금 {log.refund} 회수</div>}
            {log.terms === "bully" && !log.independence && <div className="text-[#7c2d12]">약한 상대라 상납·전리품이 줄었어요</div>}
            {log.terms === "underdog" && !log.independence && log.attackerWon && <div>🔥 강적을 꺾어 상납·전리품 증가!</div>}
            {log.brokenA.length > 0 && <div>🔧 {log.a.name} 파손: {log.brokenA.map((b) => itemLabel(b.id, b.count)).join(", ")}</div>}
            {log.brokenD.length > 0 && <div>🔧 {log.d.name} 파손: {log.brokenD.map((b) => itemLabel(b.id, b.count)).join(", ")}</div>}
          </div>
        )}
      </div>

      <div className="safe-bottom flex gap-2 p-4">
        {!done ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStep(log.shots.length);
            }}
            className="h-12 flex-1 bg-sea-700 font-bold shadow-[3px_3px_0_rgba(0,0,0,.5)]"
          >
            건너뛰기 ⏩
          </button>
        ) : (
          <button
            onClick={onClose}
            className={`h-12 flex-1 font-black text-sea-950 shadow-[3px_3px_0_rgba(0,0,0,.5)] ${involved && !iWon ? "bg-slate-300" : "bg-gold-400"}`}
          >
            {involved ? (iWon ? "🏴‍☠️ 승리! 닫기" : "😵 패배… 닫기") : "닫기"}
          </button>
        )}
      </div>
    </div>
  );
}

function Side({
  name,
  tier,
  hp,
  max,
  flip,
  hit,
  firing,
}: {
  name: string;
  tier: number;
  hp: number;
  max: number;
  flip?: boolean;
  hit: boolean;
  firing: boolean;
}) {
  const pct = Math.max(0, Math.round((hp / max) * 100));
  const bar = pct > 50 ? "#22c55e" : pct > 25 ? "#eab308" : "#dc2626";
  return (
    <div className="flex w-[45%] flex-col items-center">
      <div className="mb-1 w-full truncate text-center text-xs font-black text-white drop-shadow-[1px_1px_0_#000]">{name}</div>
      <div className="mb-2 h-3 w-full border-2 border-[#0b1220] bg-[#0b1220]">
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: bar }} />
      </div>
      <div className="text-[11px] font-bold text-white drop-shadow-[1px_1px_0_#000]">
        {hp}/{max}
      </div>
      <div className={`relative ${hit ? "pp-shake" : "pp-bob-ship"}`}>
        <div dangerouslySetInnerHTML={{ __html: shipSvg(tier, 4, flip) }} />
        {firing && (
          <span className={`absolute top-1/3 text-xl ${flip ? "-left-3" : "-right-3"}`} aria-hidden>
            💨
          </span>
        )}
        {hit && (
          <span className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden>
            💥
          </span>
        )}
      </div>
    </div>
  );
}
