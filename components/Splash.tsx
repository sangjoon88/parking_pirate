"use client";

import { UnifrakturCook } from "next/font/google";
import { useEffect, useState } from "react";
import PixelFlag from "./PixelFlag";

// 스플래시 제목용 블랙레터 (빌드할 때 내려받아 앱과 함께 배포됨, 외부 요청 없음)
const blackletter = UnifrakturCook({ weight: "700", subsets: ["latin"], display: "block" });

const KEY = "pp_splash_seen";
const SHOW_MS = 1400;

/**
 * 앱을 열 때 한 번 보이는 스플래시 (같은 탭에서 화면을 옮길 때는 다시 안 뜸).
 * 서버 렌더링 HTML에 처음부터 들어 있어서 지도 로딩 전 빈 화면 대신 바로 보인다.
 */
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* 저장 못 해도 괜찮다 */
    }
    const fadeAt = seen ? 0 : SHOW_MS;
    const t1 = setTimeout(() => setPhase("fade"), fadeAt);
    const t2 = setTimeout(() => setPhase("gone"), fadeAt + 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      aria-hidden
      onClick={() => setPhase("fade")}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-sea-950 transition-opacity duration-300 ${
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <PixelFlag className="w-[min(72vw,320px)]" />
      <h1 lang="en" className={`pp-pixel-title mt-6 text-[2.75rem] leading-none text-gold-400 ${blackletter.className}`}>
        Parking Pirate
      </h1>
      <p className="mt-2 text-xs font-bold tracking-[0.3em] text-slate-400">YEOUIDO FLEET</p>
    </div>
  );
}
