"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { DESCRIPTION_MAX } from "@/lib/game";
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
  onCreated: (id: string, earned: number, newCell: boolean, wondersSolved: number) => void;
  onDuplicate: (existing: ExistingSpot) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
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

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ id: string; earned: number; newCell: boolean; wondersSolved: number }>("/api/spots", {
        method: "POST",
        json: { name, address, description, lat: position.lat, lng: position.lng },
      });
      onCreated(res.id, res.earned, res.newCell, res.wondersSolved);
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
    <Sheet
      onClose={onClose}
      title={<h2 className="text-xl font-black">새 정박지 등록</h2>}
      footer={
        <Button onClick={submit} disabled={busy || name.trim().length < 2} className="w-full">
          {busy ? "등록 중…" : "☠ 정박지 등록"}
        </Button>
      }
    >
      <div className="space-y-3 pb-1">
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
        />
        <label className="block">
          <span className="mb-1 flex justify-between text-sm text-slate-300">
            정박지 소개 (선택)
            <span className="text-slate-500">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
            rows={3}
            placeholder="예: 정문 말고 후문 쪽 입구로. 지하 1층 방문자 칸 넉넉함."
            className="w-full rounded-xl border border-sea-600 bg-sea-900 px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-gold-400"
          />
        </label>
        <p className="text-xs text-slate-400">차단기가 없는 아파트 단지만 등록해 주세요. 첫 발견자로 기록돼요 ☠</p>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
