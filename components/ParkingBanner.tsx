"use client";

import { useEffect, useState } from "react";
import { duration, timeAgo } from "@/lib/format";
import type { ActiveParking } from "@/lib/types";

export default function ParkingBanner({
  parking,
  onEnd,
  onTap,
  busy,
}: {
  parking: NonNullable<ActiveParking>;
  onEnd: () => void;
  onTap: () => void;
  busy: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const alert = parking.navyAlert;

  return (
    <div className={`rounded-2xl shadow-lg ${alert ? "bg-red-600 text-white" : "bg-gold-400 text-sea-950"}`}>
      <div className="flex items-center gap-2 py-2 pr-2 pl-4">
        <button onClick={onTap} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-black">⚓ {parking.spotName} 정박 중</div>
          <div className="text-xs font-semibold opacity-80">{duration(parking.startedAt)} 경과</div>
        </button>
        <button
          onClick={onEnd}
          disabled={busy}
          className="h-11 shrink-0 rounded-xl bg-sea-950 px-4 text-sm font-bold text-gold-400 disabled:opacity-50"
        >
          {busy ? "…" : "출항"}
        </button>
      </div>
      {alert && (
        <div className="border-t border-white/30 px-4 py-1.5 text-xs font-bold">
          ⚠ 해군 출몰! {alert.by}님 제보 · {timeAgo(alert.at)}
        </div>
      )}
    </div>
  );
}
