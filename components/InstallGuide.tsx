"use client";

import { useSyncExternalStore } from "react";

type Platform = "ios" | "android" | "other" | "installed";

const noop = () => () => {};

function detect(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function InstallGuide() {
  // 서버 렌더링에서는 null, 브라우저에서만 기기 판별
  const platform = useSyncExternalStore<Platform | null>(noop, detect, () => null);
  if (!platform || platform === "installed") return null;

  return (
    <section className="rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 text-sm">
      <h2 className="mb-2 font-bold text-gold-400">📲 홈 화면에 추가하기</h2>
      {platform === "ios" ? (
        <ol className="list-decimal space-y-1 pl-5 text-slate-300">
          <li>
            Safari 아래쪽 <b>공유 버튼(□↑)</b>을 누르세요.
          </li>
          <li>
            <b>홈 화면에 추가</b>를 고르세요.
          </li>
          <li>홈 화면의 아이콘으로 열면 앱처럼 쓸 수 있어요.</li>
        </ol>
      ) : platform === "android" ? (
        <ol className="list-decimal space-y-1 pl-5 text-slate-300">
          <li>
            Chrome 오른쪽 위 <b>⋮ 메뉴</b>를 누르세요.
          </li>
          <li>
            <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 고르세요.
          </li>
        </ol>
      ) : (
        <p className="text-slate-300">휴대폰 브라우저에서 열고 “홈 화면에 추가”를 하면 앱처럼 쓸 수 있어요.</p>
      )}
    </section>
  );
}
