"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 화면 아래에서 올라오는 시트.
 * - 손잡이/제목 영역을 아래로 끌면 닫힘, ESC로도 닫힘
 * - footer는 스크롤과 상관없이 하단에 고정 (주요 버튼용)
 */
export default function Sheet({
  onClose,
  children,
  title,
  footer,
}: {
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dragHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      startY.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current == null) return;
      setDrag(Math.max(0, e.touches[0].clientY - startY.current));
    },
    onTouchEnd: () => {
      if (drag > 90) onClose();
      setDrag(0);
      startY.current = null;
    },
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="닫기" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className="animate-sheet-up relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-sea-900 shadow-2xl"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? "none" : "transform .15s" }}
      >
        <div className="shrink-0 touch-none px-5 pt-3" {...dragHandlers}>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-sea-600" />
          {title && (
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">{title}</div>
              <button onClick={onClose} className="-mt-1 -mr-2 h-10 w-10 shrink-0 text-2xl text-slate-400" aria-label="닫기">
                ×
              </button>
            </div>
          )}
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? "pb-3" : "safe-bottom pb-5"}`}>
          {children}
        </div>
        {footer && <div className="safe-bottom shrink-0 border-t border-sea-700 px-5 pt-3 pb-4">{footer}</div>}
      </div>
    </div>
  );
}
