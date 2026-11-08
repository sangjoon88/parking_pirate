"use client";

import { useCallback, useRef, useState } from "react";
import Sheet from "./Sheet";
import { Button } from "./ui";

/** 화면 아래쪽에 잠깐 뜨는 알림. [노드, show] 를 돌려준다 */
export function useToast(bottomClass = "bottom-24") {
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, ms = 3500) => {
    setMsg(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), ms);
  }, []);
  const node = msg ? (
    <div
      className={`pointer-events-none fixed inset-x-0 ${bottomClass} z-[60] flex justify-center px-6`}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-sm rounded-2xl bg-black/90 px-4 py-2.5 text-center text-sm whitespace-pre-line shadow-xl">
        {msg}
      </div>
    </div>
  ) : null;
  return [node, show] as const;
}

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean };

/** 브라우저 confirm() 대신 쓰는 하단 확인 시트. await confirm({...}) → true/false */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const node = state ? (
    <Sheet onClose={() => close(false)} title={<h2 className="text-lg font-black">{state.title}</h2>}>
      {state.message && <p className="mb-4 text-sm whitespace-pre-line text-slate-300">{state.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => close(false)}>
          취소
        </Button>
        <Button variant={state.danger ? "danger" : "primary"} onClick={() => close(true)}>
          {state.confirmLabel ?? "확인"}
        </Button>
      </div>
    </Sheet>
  ) : null;
  return [node, confirm] as const;
}

/** 금액 고르기 시트 (현상금 걸기, 보물 묻기, 결투 판돈) */
export function AmountSheet({
  title,
  description,
  options,
  balance,
  confirmLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  options: readonly number[];
  balance: number | null;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState<number>(options[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lacking = balance != null && amount > balance;
  return (
    <Sheet onClose={onClose} title={<h2 className="text-lg font-black">{title}</h2>}>
      <p className="mb-3 text-sm text-slate-300">{description}</p>
      <div className="grid grid-cols-4 gap-2">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => setAmount(n)}
            className={`min-h-12 rounded-xl border-2 font-black ${
              amount === n ? "border-gold-400 bg-gold-400/15 text-gold-400" : "border-transparent bg-sea-800"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {balance != null && (
        <p className={`mt-2 text-xs ${lacking ? "text-red-400" : "text-slate-400"}`}>
          보유 💰 {balance} {lacking && "· 두블룬이 모자라요"}
        </p>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}
      <Button
        className="mt-3 w-full"
        disabled={busy || lacking}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onSubmit(amount);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "처리 중…" : `${confirmLabel} (💰${amount})`}
      </Button>
    </Sheet>
  );
}
