"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Nickname from "@/components/Nickname";
import PageHeader from "@/components/PageHeader";
import { photoUrl } from "@/components/Photos";
import { ErrorText } from "@/components/ui";
import { api } from "@/lib/api";
import { getFeedSeen, setFeedSeen } from "@/lib/feedSeen";
import { guardColor, timeAgo } from "@/lib/format";
import PxText from "@/components/PxText";
import type { FeedItem } from "@/lib/types";

type Filter = "all" | FeedItem["kind"];
const FILTERS: [Filter, string][] = [
  ["all", "전체"],
  ["spot", "☠ 발견"],
  ["report", "📜 일지"],
  ["battle", "⚔️ 해전"],
];

export default function NewsScreen() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // 들어오기 전에 마지막으로 본 시각: 그 뒤 글에 NEW 표시
  const [seenBefore] = useState(() => (typeof window === "undefined" ? null : getFeedSeen()));

  useEffect(() => {
    api<{ items: FeedItem[] }>("/api/feed")
      .then((d) => {
        setItems(d.items);
        if (d.items[0]) setFeedSeen(d.items[0].createdAt);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const shown = items?.filter((i) => filter === "all" || i.kind === filter) ?? null;

  return (
    <div className="pb-8">
      <PageHeader title="새 소식" right={<span className="text-xs text-slate-400">최근 30일</span>} />
      <div className="px-5">
        <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-sea-800 p-1 text-sm font-bold">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`h-10 rounded-lg ${filter === k ? "bg-gold-400 text-sea-950" : "text-slate-300"}`}
            >
              <PxText text={label} />
            </button>
          ))}
        </div>
        <ErrorText>{error}</ErrorText>
        {shown === null && !error && <div className="h-40 animate-pulse rounded-2xl bg-sea-800" />}
        {shown && shown.length === 0 && <p className="py-10 text-center text-sm text-slate-500">아직 소식이 없어요.</p>}
        <ul className="space-y-2">
          {shown?.map((it) => (
            <li key={`${it.kind}:${it.id}`}>
              <FeedCard item={it} isNew={!!seenBefore && it.createdAt > seenBefore} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FeedCard({ item: it, isNew }: { item: FeedItem; isNew: boolean }) {
  const who = <Nickname name={it.nickname} color={it.nameColor} effect={it.nameEffect} className="font-bold" />;
  const head = (icon: string, text: React.ReactNode) => (
    <div className="flex items-start gap-2">
      <span className="text-lg leading-6">
        <PxText text={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-6">{text}</div>
      {isNew && <span className="pixel-tag shrink-0 bg-red-500 text-white">NEW</span>}
    </div>
  );
  const meta = <div className="mt-0.5 pl-7 text-[11px] text-slate-500">{timeAgo(it.createdAt)}</div>;

  if (it.kind === "battle" && it.battle) {
    const b = it.battle;
    return (
      <Link href="/fleet" className="block rounded-xl border border-red-500/30 bg-sea-800 px-3 py-2.5 active:bg-sea-700">
        {head(
          b.independence ? "🗽" : "⚔️",
          <>
            <b>{b.attacker}</b>
            {b.independence ? "이(가) 독립 전쟁을 일으켰어요 → " : "이(가) "}
            <b>{b.defender}</b>
            {b.independence ? "" : "을(를) 공격 → "}
            <span className={b.attackerWon ? "text-gold-400" : "text-slate-300"}>
              {b.attackerWon ? (b.independence ? "독립 성공!" : "격파! 1주일간 휘하로") : "격퇴당함"}
            </span>
          </>,
        )}
        {meta}
      </Link>
    );
  }

  const href = it.spotId ? `/?spot=${it.spotId}` : "/";
  return (
    <Link href={href} className="block rounded-xl bg-sea-800 px-3 py-2.5 active:bg-sea-700">
      {it.kind === "spot"
        ? head(
            "☠",
            <>
              {who}님이 새 정박지 <b className="text-gold-400">{it.spotName}</b>을(를) 발견했어요
            </>,
          )
        : head(
            "📜",
            <>
              {who} · <b>{it.spotName}</b>
              {it.guardLevel != null && (
                <span className="ml-1.5 text-xs font-bold" style={{ color: guardColor(it.guardLevel, false) }}>
                  경계 {it.guardLevel}
                </span>
              )}
              {it.gateStatus === "no_gate" && <span className="ml-1.5 text-xs text-green-400">차단기 없음</span>}
              {it.gateStatus === "gate_installed" && <span className="ml-1.5 text-xs text-red-400">차단기 생김</span>}
            </>,
          )}
      {it.note && <p className="mt-1 line-clamp-3 pl-7 text-sm break-words whitespace-pre-wrap text-slate-200">{it.note}</p>}
      {it.photoId && (
        <div className="mt-2 ml-7 h-24 w-32 overflow-hidden rounded-lg bg-sea-900">
          {/* eslint-disable-next-line @next/next/no-img-element -- 로그인 쿠키가 필요한 API 사진 */}
          <img src={photoUrl(it.photoId)} alt="일지 사진" loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      {meta}
    </Link>
  );
}
