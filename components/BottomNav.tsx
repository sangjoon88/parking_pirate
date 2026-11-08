"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "지도", icon: "🗺️" },
  { href: "/crew", label: "선원 명부", icon: "🏴‍☠️" },
  { href: "/me", label: "내 정보", icon: "🧭" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom shrink-0 border-t border-sea-700 bg-sea-900">
      <ul className="grid grid-cols-3">
        {TABS.map((t) => {
          const on = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold ${
                  on ? "text-gold-400" : "text-slate-400"
                }`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
