"use client";

import { useState } from "react";
import { AuthShell, Button, ErrorText, Input } from "@/components/ui";
import { api } from "@/lib/api";

export default function LoginForm({ next }: { next: string }) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: { nickname, password } });
      window.location.href = next;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthShell title="선원 확인">
      <form onSubmit={submit} className="space-y-4">
        <Input label="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="username" required />
        <Input
          label="비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "확인 중…" : "승선하기"}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-slate-400">
        처음이라면 선원에게 받은 승선권 링크로 들어와 주세요.
      </p>
    </AuthShell>
  );
}
