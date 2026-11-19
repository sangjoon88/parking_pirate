"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FEED_SEEN_EVENT, getFeedSeen } from "@/lib/feedSeen";

const TABS = [
  { href: "/", label: "지도", icon: "🗺️" },
  { href: "/news", label: "새 소식", icon: "📰" },
  { href: "/fleet", label: "해적단", icon: "⚔️" },
  { href: "/crew", label: "선원 명부", icon: "🏴‍☠️" },
  { href: "/me", label: "내 정보", icon: "🧭" },
];

/** 하단 탭. 새 소식에 안 본 글이 있으면 빨간 점 */
export default function BottomNav() {
  const pathname = usePathname();
  const [latest, setLatest] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ latest: string | null }>("/api/feed?head=1")
      .then((d) => alive && setLatest(d.latest))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const sync = () => setSeen(getFeedSeen());
    sync();
    window.addEventListener(FEED_SEEN_EVENT, sync);
    return () => window.removeEventListener(FEED_SEEN_EVENT, sync);
  }, []);

  const unread = !!latest && (!seen || latest > seen);

  return (
    <nav className="safe-bottom shrink-0 border-t border-sea-700 bg-sea-900">
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const on = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                  on ? "text-gold-400" : "text-slate-400"
                }`}
              >
                <span className="relative text-xl leading-none">
                  {t.icon}
                  {t.href === "/news" && unread && !on && (
                    <span className="absolute -top-0.5 -right-1.5 h-2.5 w-2.5 bg-red-500 shadow-[1px_1px_0_#000]" aria-label="새 글" />
                  )}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
