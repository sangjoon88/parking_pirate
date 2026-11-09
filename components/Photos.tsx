"use client";

/* eslint-disable @next/next/no-img-element -- 로그인 쿠키가 필요한 API 사진이라 next/image 최적화를 쓰지 않는다 */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { SPOT_PHOTO_MAX } from "@/lib/game";
import { uploadPhoto } from "@/lib/image";
import type { SpotPhoto } from "@/lib/types";
import { useConfirm } from "./feedback";

export const PHOTO_NOTICE = "차량 번호판·사람 얼굴은 피해서 찍어 주세요. 사진 속 위치 정보는 자동으로 지워져요.";

export const photoUrl = (id: string) => `/api/photos/${id}`;

/** 정박지 소개 사진: 가로 스크롤 썸네일 + 추가 버튼 */
export function SpotPhotoStrip({
  spotId,
  photos,
  onChanged,
}: {
  spotId: string;
  photos: SpotPhoto[] | null;
  onChanged: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<SpotPhoto | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files).slice(0, Math.max(0, SPOT_PHOTO_MAX - (photos?.length ?? 0)));
    setUploading(list.length);
    let ok = 0;
    for (const f of list) {
      try {
        await uploadPhoto(spotId, f);
        ok++;
      } catch (e) {
        setError((e as Error).message);
      }
      setUploading((n) => n - 1);
    }
    if (inputRef.current) inputRef.current.value = "";
    if (ok) onChanged(`📷 사진 ${ok}장을 올렸어요`);
  }

  const full = (photos?.length ?? 0) >= SPOT_PHOTO_MAX;

  return (
    <div className="mt-3 rounded-xl bg-sea-800 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-300">
          📷 사진 <span className="font-normal text-slate-500">{photos?.length ?? 0}</span>
        </h3>
        <span className="text-[11px] text-slate-500">입구·진입로·방문자 칸</span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {!full && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading > 0}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-sea-600 text-xs font-bold text-slate-300 disabled:opacity-60"
          >
            {uploading > 0 ? (
              <span className="animate-pulse">올리는 중…</span>
            ) : (
              <>
                <span className="text-2xl leading-none">＋</span>
                사진 추가
              </>
            )}
          </button>
        )}
        {photos?.map((p) => (
          <button key={p.id} onClick={() => setViewing(p)} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sea-900">
            <img src={photoUrl(p.id)} alt={`${p.nickname}님이 올린 사진`} loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
        {photos?.length === 0 && (
          <p className="self-center px-1 text-xs text-slate-500">아직 사진이 없어요. 입구나 진입로 사진이 있으면 찾아가기 쉬워요.</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      {!full && <p className="mt-1 text-[11px] text-slate-500">{PHOTO_NOTICE}</p>}
      {viewing && (
        <PhotoViewer
          id={viewing.id}
          caption={`${viewing.nickname} · ${timeAgo(viewing.createdAt)}`}
          canDelete={viewing.canDelete}
          onClose={() => setViewing(null)}
          onDeleted={() => {
            setViewing(null);
            onChanged("📷 사진을 지웠어요");
          }}
        />
      )}
    </div>
  );
}

/** 전체 화면 사진 보기 */
export function PhotoViewer({
  id,
  caption,
  canDelete,
  onClose,
  onDeleted,
}: {
  id: string;
  caption: string;
  canDelete?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [confirmNode, confirm] = useConfirm();
  const [error, setError] = useState("");
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="사진 보기">
      <div className="safe-top flex items-center justify-between px-3 py-2">
        <span className="truncate text-sm text-slate-300">{caption}</span>
        <div className="flex shrink-0 gap-1">
          {canDelete && (
            <button
              onClick={async () => {
                const ok = await confirm({ title: "사진을 지울까요?", confirmLabel: "지우기", danger: true });
                if (!ok) return;
                try {
                  await api(photoUrl(id), { method: "DELETE" });
                  onDeleted?.();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              className="h-10 rounded-lg px-3 text-sm font-bold text-red-400"
            >
              지우기
            </button>
          )}
          <button onClick={onClose} className="h-10 w-10 text-2xl text-white" aria-label="닫기">
            ×
          </button>
        </div>
      </div>
      <button className="flex min-h-0 flex-1 items-center justify-center" onClick={onClose} aria-label="닫기">
        <img src={photoUrl(id)} alt="" className="max-h-full max-w-full object-contain" />
      </button>
      {error && <p className="safe-bottom px-4 py-2 text-center text-sm text-red-300">{error}</p>}
      {confirmNode}
    </div>
  );
}

/** 일지 쓰기에서 사진 한 장 고르기 (미리보기) */
export function PhotoPicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 파일이 바뀔 때 미리보기 URL을 만들고 정리
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      {file && preview ? (
        <div className="relative h-32 w-32 overflow-hidden rounded-xl bg-sea-800">
          <img src={preview} alt="고른 사진" className="h-full w-full object-cover" />
          <button
            onClick={() => {
              onChange(null);
              setPreview(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute top-1 right-1 h-8 w-8 rounded-full bg-black/70 text-lg"
            aria-label="사진 빼기"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sea-600 text-sm font-bold text-slate-300"
        >
          📷 사진 붙이기 (선택)
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <p className="mt-1 text-[11px] text-slate-500">{PHOTO_NOTICE}</p>
    </div>
  );
}
