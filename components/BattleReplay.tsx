"use client";

import { useEffect, useRef, useState } from "react";
import { drawBattle, endTime, H, shotTime, T, W } from "@/lib/battleScene";
import type { BattleView } from "@/lib/fleetTypes";
import { itemOf } from "@/lib/naval";
import { ITEM_PX } from "@/lib/pixelIcons";
import { setSfxOn, sfx, sfxOn } from "@/lib/sfx";
import Px from "./Px";

/**
 * 해전 다시 보기: 캔버스에 도트 해전을 그리고, 위에는 체력 막대, 아래에는 포격 기록.
 * 포격·명중·물보라·침몰에 맞춰 효과음과 진동 (끄기 가능).
 */
export default function BattleReplay({ battle, myId, onClose }: { battle: BattleView; myId: string; onClose: () => void }) {
  const { log } = battle;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const skipRef = useRef(0); // 건너뛰기: 시간을 앞당긴 만큼
  const firedRef = useRef(-1); // 소리 낸 마지막 포격 (발사)
  const landedRef = useRef(-1); // 소리 낸 마지막 포격 (착탄)
  const endSoundRef = useRef(false);
  const [applied, setApplied] = useState(0); // 화면 기록에 반영된 포격 수
  const [ended, setEnded] = useState(false);
  const [sound, setSound] = useState(() => (typeof window === "undefined" ? true : sfxOn()));

  const end = endTime(log);
  const iAmA = log.a.userId === myId;
  const involved = iAmA || log.d.userId === myId;
  const iWon = iAmA ? log.attackerWon : !log.attackerWon;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    startRef.current = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const t = now - startRef.current + skipRef.current;
      drawBattle(ctx, t, log);

      // 소리: 발사 / 착탄
      const idx = Math.floor((t - T.intro) / T.shot);
      if (idx >= 0 && idx < log.shots.length) {
        const s = log.shots[idx];
        const weapon = log.gear ? log.gear[s.by].weapon : "cannon";
        if (firedRef.current < idx) {
          firedRef.current = idx;
          if (skipRef.current === 0) sfx.fire(weapon);
        }
        if (landedRef.current < idx && t >= shotTime(idx) + T.shot * T.flight) {
          landedRef.current = idx;
          const target = s.by === "a" ? "d" : "a";
          if (skipRef.current === 0) {
            if (!s.hit) sfx.splash();
            else if (log.gear?.[target].armor === "blackhole") sfx.absorb();
            else sfx.hit(s.crit, weapon === "hyunmoo");
          }
        }
      }
      // 기록·체력 반영: 착탄한 포격까지
      const landed = Math.max(0, Math.min(log.shots.length, Math.floor((t - T.intro - T.shot * T.flight) / T.shot) + 1));
      setApplied((prev) => (prev === landed ? prev : landed));
      if (t >= end && !endSoundRef.current) {
        endSoundRef.current = true;
        setEnded(true);
        sfx.sink();
        setTimeout(() => (involved ? (iWon ? sfx.win() : sfx.lose()) : sfx.win()), 900);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [log, end, involved, iWon]);

  // 기록이 늘면 맨 아래로
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [applied, ended]);

  const last = applied > 0 ? log.shots[applied - 1] : null;
  const hpA = last ? last.hpA : log.a.hp0;
  const hpD = last ? last.hpD : log.d.hp0;

  function skip() {
    const t = performance.now() - startRef.current + skipRef.current;
    if (t < end) skipRef.current += end - t;
  }

  const headline = log.independence
    ? log.attackerWon
      ? `${log.a.name} 독립 성공!`
      : `${log.a.name}의 독립 실패`
    : log.attackerWon
      ? `${log.a.name} 승리! ${log.d.name}은(는) 1주일간 휘하로`
      : `${log.d.name}이(가) 지켜 냈다!`;

  const weaponIcon = (by: "a" | "d") => {
    const id = log.gear?.[by].weapon;
    return id && ITEM_PX[id] ? ITEM_PX[id] : "cannon";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a1424]">
      <div className="safe-top flex items-center gap-2 px-4 pt-3">
        <Px name="swords" size={18} />
        <h2 className="min-w-0 flex-1 truncate text-base font-black">
          {log.a.name} <span className="text-slate-500">vs</span> {log.d.name}
          {log.independence && <span className="ml-1 text-xs text-sky-300">독립 전쟁</span>}
        </h2>
        <button
          onClick={() => {
            const on = !sound;
            setSound(on);
            setSfxOn(on);
          }}
          className="flex h-9 w-9 items-center justify-center bg-sea-800 shadow-[2px_2px_0_rgba(0,0,0,.5)]"
          aria-label={sound ? "효과음 끄기" : "효과음 켜기"}
        >
          <Px name={sound ? "speaker" : "mute"} size={20} />
        </button>
      </div>

      {/* 체력 막대 */}
      <div className="mt-2 grid grid-cols-2 gap-3 px-4">
        <HpBar name={log.a.name} hp={hpA} max={log.a.maxHp} weapon={weaponIcon("a")} />
        <HpBar name={log.d.name} hp={hpD} max={log.d.maxHp} weapon={weaponIcon("d")} right />
      </div>

      {/* 도트 해전 장면 */}
      <div className="mx-4 mt-2 border-4 border-[#2b1d0e] shadow-[4px_4px_0_rgba(0,0,0,.5)]">
        <canvas ref={canvasRef} width={W} height={H} className="block w-full" style={{ imageRendering: "pixelated", aspectRatio: `${W} / ${H}` }} />
      </div>

      {/* 포격 기록 */}
      <div
        ref={logRef}
        className="mx-4 mt-3 min-h-0 flex-1 overflow-y-auto border-2 border-[#2b1d0e] bg-[#f4ead2] p-3 text-[13px] leading-6 text-[#2b1d0e]"
      >
        {log.shots.slice(0, applied).map((s, i) => {
          const who = s.by === "a" ? log.a.name : log.d.name;
          return (
            <div key={i}>
              <Px name={s.hit ? "boom" : "splash"} size={14} className="mr-1" />
              <b>{who}</b> {s.hit ? (s.crit ? `치명타! −${s.dmg}` : `명중 −${s.dmg}`) : "빗나감"}
              {s.taunt && (
                <div className="pl-5 text-[#7c2d12]">
                  <Px name="npc-parrot" size={14} className="mr-1" />
                  {s.taunt}
                </div>
              )}
            </div>
          );
        })}
        {ended && (
          <div className="mt-2 space-y-0.5 border-t-2 border-dashed border-[#2b1d0e]/40 pt-2">
            <div className="flex items-center gap-1.5 font-black">
              <Px name={log.attackerWon ? "flag" : "shield"} size={16} />
              {headline}
            </div>
            {log.loot > 0 && (
              <div>
                <Px name="coin" size={14} className="mr-1" />
                전리품 +{log.loot} ({log.a.name})
              </div>
            )}
            {log.tributeRate > 0 && (
              <div>
                <Px name="scroll" size={14} className="mr-1" />
                상납 {log.tributeRate}% · 1주일
              </div>
            )}
            {log.defense > 0 && (
              <div>
                <Px name="shield" size={14} className="mr-1" />
                방어 보상 +{log.defense} ({log.d.name})
              </div>
            )}
            {log.refund > 0 && (
              <div>
                <Px name="coin" size={14} className="mr-1" />
                그동안 낸 상납금 {log.refund} 회수
              </div>
            )}
            {log.terms === "bully" && !log.independence && <div className="text-[#7c2d12]">약한 상대라 상납·전리품이 줄었어요</div>}
            {log.terms === "underdog" && !log.independence && log.attackerWon && <div>강적을 꺾어 상납·전리품 증가!</div>}
            {[
              [log.a.name, log.brokenA],
              [log.d.name, log.brokenD],
            ].map(([name, broken]) =>
              (broken as typeof log.brokenA).length ? (
                <div key={name as string}>
                  <Px name="wrench" size={14} className="mr-1" />
                  {name as string} 파손:{" "}
                  {(broken as typeof log.brokenA).map((b) => (
                    <span key={b.id} className="mr-1.5 whitespace-nowrap">
                      <Px name={ITEM_PX[b.id] ?? "cannon"} size={14} /> {itemOf(b.id)?.name}
                      {b.count > 1 ? ` ×${b.count}` : ""}
                    </span>
                  ))}
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      <div className="safe-bottom flex gap-2 p-4">
        {!ended ? (
          <button onClick={skip} className="h-12 flex-1 bg-sea-700 font-bold shadow-[3px_3px_0_rgba(0,0,0,.5)]">
            건너뛰기 ≫
          </button>
        ) : (
          <button
            onClick={onClose}
            className={`flex h-12 flex-1 items-center justify-center gap-2 font-black text-sea-950 shadow-[3px_3px_0_rgba(0,0,0,.5)] ${
              involved && !iWon ? "bg-slate-300" : "bg-gold-400"
            }`}
          >
            <Px name={involved && !iWon ? "skull" : "crown"} size={20} />
            {involved ? (iWon ? "승리! 닫기" : "패배… 닫기") : "닫기"}
          </button>
        )}
      </div>
    </div>
  );
}

function HpBar({ name, hp, max, weapon, right }: { name: string; hp: number; max: number; weapon: Parameters<typeof Px>[0]["name"]; right?: boolean }) {
  const pct = Math.max(0, Math.round((hp / max) * 100));
  const bar = pct > 50 ? "#22c55e" : pct > 25 ? "#eab308" : "#dc2626";
  return (
    <div className={right ? "text-right" : ""}>
      <div className={`flex items-center gap-1 text-xs font-black ${right ? "flex-row-reverse" : ""}`}>
        <Px name={weapon} size={14} />
        <span className="truncate">{name}</span>
      </div>
      <div className="mt-1 h-3 border-2 border-[#0b1220] bg-[#0b1220]">
        <div className={`h-full transition-all duration-200 ${right ? "ml-auto" : ""}`} style={{ width: `${pct}%`, background: bar }} />
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-300">
        <Px name="heart" size={10} /> {hp}/{max}
      </div>
    </div>
  );
}
