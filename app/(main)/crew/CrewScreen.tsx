"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { ErrorText } from "@/components/ui";
import { api } from "@/lib/api";

type Member = {
  id: string;
  nickname: string;
  referrerId: string | null;
  role: "admin" | "member";
  status: "active" | "banned";
  createdAt: string;
};

export default function CrewScreen() {
  const [crew, setCrew] = useState<Member[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      api<{ me: { id: string; role: string }; crew: Member[] }>("/api/crew")
        .then((d) => {
          setCrew(d.crew);
          setMe(d.me);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const { roots, children } = useMemo(() => {
    const children = new Map<string, Member[]>();
    const ids = new Set(crew.map((c) => c.id));
    const roots: Member[] = [];
    for (const c of crew) {
      if (c.referrerId && ids.has(c.referrerId)) {
        const list = children.get(c.referrerId) ?? [];
        list.push(c);
        children.set(c.referrerId, list);
      } else {
        roots.push(c);
      }
    }
    return { roots, children };
  }, [crew]);

  async function ban(m: Member) {
    if (!confirm(`${m.nickname}님을 추방할까요?\n미사용 승선권도 함께 무효가 됩니다.`)) return;
    try {
      await api(`/api/crew/${m.id}/ban`, { method: "POST" });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const active = crew.filter((c) => c.status === "active").length;

  return (
    <div className="pb-8">
      <PageHeader title="선원 명부" right={<span className="text-sm text-slate-400">선원 {active}명</span>} />
      <div className="px-5">
        <ErrorText>{error}</ErrorText>
        <h2 className="mt-2 mb-1 font-bold">선단 계보</h2>
        <p className="mb-3 text-xs text-slate-400">누가 누구를 데려왔는지 보여줘요.</p>
        <ul className="rounded-2xl bg-sea-800 px-4 py-2">
          {roots.map((r) => (
            <Node key={r.id} m={r} depth={0} ctx={{ childrenOf: children, me, onBan: ban }} />
          ))}
        </ul>
      </div>
    </div>
  );
}

type Ctx = { childrenOf: Map<string, Member[]>; me: { id: string; role: string } | null; onBan: (m: Member) => void };

function Node({ m, depth, ctx }: { m: Member; depth: number; ctx: Ctx }) {
  const { childrenOf, me, onBan } = ctx;
  const kids = childrenOf.get(m.id) ?? [];
  const banned = m.status === "banned";
  return (
    <li>
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 18 }}>
        {depth > 0 && <span className="text-sea-600">└</span>}
        <span className={`font-semibold ${banned ? "text-slate-500 line-through" : ""}`}>
          {m.role === "admin" ? "👑 " : "☠ "}
          {m.nickname}
        </span>
        {m.id === me?.id && <span className="rounded bg-gold-400/20 px-1.5 text-[11px] text-gold-400">나</span>}
        {banned && <span className="text-xs text-red-400">추방됨</span>}
        {kids.length > 0 && <span className="text-xs text-slate-500">+{kids.length}</span>}
        {me?.role === "admin" && !banned && m.role !== "admin" && (
          <button onClick={() => onBan(m)} className="ml-auto h-8 rounded-lg px-2 text-xs text-red-400 active:bg-red-950">
            추방
          </button>
        )}
      </div>
      {kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <Node key={k.id} m={k} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}
