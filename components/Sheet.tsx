"use client";

/** 화면 아래에서 올라오는 시트 */
export default function Sheet({
  onClose,
  children,
  title,
}: {
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true">
      <button aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="safe-bottom animate-sheet-up relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-sea-900 px-5 pt-3 pb-5 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-sea-600" />
        {title && (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{title}</div>
            <button onClick={onClose} className="-mr-2 h-10 w-10 shrink-0 text-2xl text-slate-400" aria-label="닫기">
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
