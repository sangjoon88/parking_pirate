"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { reverseGeocode, type Kakao, type LatLng } from "@/lib/kakao";
import Sheet from "./Sheet";
import { Button, ErrorText, Input } from "./ui";

export type ExistingSpot = { id: string; name: string; lat: number; lng: number };

export default function NewSpotSheet({
  kakao,
  position,
  onClose,
  onCreated,
  onDuplicate,
}: {
  kakao: Kakao | null;
  position: LatLng;
  onClose: () => void;
  onCreated: (id: string, earned: number, newCell: boolean) => void;
  onDuplicate: (existing: ExistingSpot) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lookingUp, setLookingUp] = useState(!!kakao);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!kakao) return;
    let alive = true;
    reverseGeocode(kakao, position).then((r) => {
      if (!alive) return;
      setAddress(r.address);
      if (r.building) setName((n) => n || r.building);
      setLookingUp(false);
    });
    return () => {
      alive = false;
    };
  }, [kakao, position]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ id: string; earned: number; newCell: boolean }>("/api/spots", {
        method: "POST",
        json: { name, address, lat: position.lat, lng: position.lng },
      });
      onCreated(res.id, res.earned, res.newCell);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data.existing) {
        onDuplicate(err.data.existing as ExistingSpot);
        return;
      }
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} title={<h2 className="text-xl font-black">새 정박지 등록</h2>}>
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-xl bg-sea-800 px-3 py-2 text-sm text-slate-300">
          📍 {lookingUp ? "주소 찾는 중…" : address || "주소를 찾지 못했어요"}
        </div>
        <Input
          label="단지명"
          placeholder="예: 해적마을 1단지"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          autoFocus
        />
        <p className="text-xs text-slate-400">차단기가 없는 아파트 단지만 등록해 주세요. 첫 발견자로 기록돼요 ☠</p>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy || name.trim().length < 2} className="w-full">
          {busy ? "등록 중…" : "정박지 등록"}
        </Button>
      </form>
    </Sheet>
  );
}
