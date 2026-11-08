import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-gold-400 text-sea-950 active:bg-gold-500",
    ghost: "bg-sea-700 text-white active:bg-sea-600",
    danger: "bg-red-600 text-white active:bg-red-700",
  }[variant];
  return (
    <button
      {...props}
      className={`min-h-12 rounded-xl px-4 text-base font-bold transition disabled:opacity-40 ${styles} ${className}`}
    />
  );
}

export function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-300">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded-xl border border-sea-600 bg-sea-900 px-4 text-white outline-none placeholder:text-slate-500 focus:border-gold-400"
      />
    </label>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{children}</p>;
}

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="text-5xl">☠</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight">주차해적단</h1>
        <p className="mt-1 text-sm text-slate-400">{title}</p>
      </div>
      {children}
    </main>
  );
}
