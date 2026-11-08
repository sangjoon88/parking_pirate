"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthShell, Button, ErrorText, Input } from "@/components/ui";
import { api } from "@/lib/api";

type Check = { ok: true; referrer: string } | { ok: false; reason: string; message: string };

export default function JoinForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(!!initialCode);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchCheck = useCallback(
    (c: string) =>
      api<Check>(`/api/auth/invite?code=${encodeURIComponent(c)}`)
        .then((r) => {
          setCheck(r);
          setError("");
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setChecking(false)),
    [],
  );

  function verify(c: string) {
    setChecking(true);
    void fetchCheck(c);
  }

  useEffect(() => {
    if (initialCode) void fetchCheck(initialCode);
  }, [initialCode, fetchCheck]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) return setError("비밀번호가 서로 달라요.");
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/join", { method: "POST", json: { code, nickname, password } });
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // 1단계: 승선권 확인
  if (!check?.ok) {
    return (
      <AuthShell title="승선권 확인">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="space-y-4"
        >
          <Input
            label="승선권 코드"
            placeholder="예: K7Q2-M9XP"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
          <ErrorText>{check && !check.ok ? check.message : error}</ErrorText>
          <Button type="submit" disabled={checking || !code.trim()} className="w-full">
            {checking ? "확인 중…" : "승선권 확인"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  // 2단계: 가입
  return (
    <AuthShell title="새 선원 등록">
      <div className="mb-6 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-center">
        <b className="text-gold-400">{check.referrer}</b>님의 추천으로 승선합니다
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="닉네임 (2~12자)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="username"
          maxLength={12}
          required
        />
        <Input
          label="비밀번호 (6자 이상)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <Input
          label="비밀번호 확인"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          autoComplete="new-password"
          required
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "승선 중…" : "승선하기"}
        </Button>
      </form>
    </AuthShell>
  );
}
