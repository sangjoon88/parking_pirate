"use client";

import Px from "./Px";
import PxText from "./PxText";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { GUARD_LABELS, guardColor, timeAgo } from "@/lib/format";
import { BOUNTY_POST, DESCRIPTION_MAX, FLEET_SIZE, GUARD_LABEL_MAX, LEGEND_PARKINGS, STASH } from "@/lib/game";
import type { ActiveParking, GuardContact, SpotPhoto, SpotReport, SpotSummary } from "@/lib/types";
import { AmountSheet, useConfirm } from "./feedback";
import { PhotoViewer, photoUrl, SpotPhotoStrip } from "./Photos";
import ReportSheet from "./ReportSheet";
import Sheet from "./Sheet";
import { Button, ErrorText } from "./ui";

type Props = {
  spotId: string;
  fallback?: SpotSummary;
  refreshKey: number;
  parking: ActiveParking;
  onClose: () => void;
  onStartParking: (spot: SpotSummary) => Promise<void>;
  onWriteReport: (spot: SpotSummary) => void;
  /** 현상금·보물·별명처럼 정박지 상태가 바뀐 뒤 (알림 문구) */
  onChanged: (message: string) => void;
};

type Detail = {
  spot: SpotSummary;
  reports: SpotReport[];
  photos: SpotPhoto[];
  guards: GuardContact[];
  me: { id: string; balance: number };
};
type Sub = null | "bounty" | "stash" | "nickname" | "description" | "guard";

const AMOUNTS = [10, 30, 50, 100] as const;
/** 처음에 보여 주는 일지 수 (나머지는 "이전 일지 더 보기") */
const REPORTS_PREVIEW = 3;

export default function SpotSheet({
  spotId,
  fallback,
  refreshKey,
  parking,
  onClose,
  onStartParking,
  onWriteReport,
  onChanged,
}: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<Sub>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewing, setViewing] = useState<SpotReport | null>(null);
  const [editing, setEditing] = useState<SpotReport | null>(null);
  const [showAllReports, setShowAllReports] = useState(false);
  const [confirmNode, confirm] = useConfirm();

  useEffect(() => {
    let alive = true;
    api<Detail>(`/api/spots/${spotId}`)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [spotId, refreshKey, reloadKey]);

  const spot = detail?.spot ?? fallback;
  if (!spot) return null;
  const reports = detail?.reports ?? null;
  const me = detail?.me;
  const closed = spot.status === "closed";
  const parkedHere = parking?.spotId === spot.id;
  const iAmLord = !!me && spot.lord?.userId === me.id;

  async function start() {
    if (!spot) return;
    setBusy(true);
    setError("");
    try {
      await onStartParking(spot);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const changed = (msg: string) => {
    setSub(null);
    setReloadKey((k) => k + 1);
    onChanged(msg);
  };

  async function deleteGuard(g: GuardContact) {
    const ok = await confirm({ title: "경비원 메모를 지울까요?", message: `${g.label || "경비원"} · ${g.digits}`, confirmLabel: "지우기", danger: true });
    if (!ok) return;
    try {
      await api(`/api/guards/${g.id}`, { method: "DELETE" });
      changed("👮 경비원 메모를 지웠어요");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteReport(r: SpotReport) {
    const ok = await confirm({
      title: "항해 일지를 지울까요?",
      message: r.mine
        ? "붙은 사진도 함께 지워져요. 이미 받은 금화는 그대로예요."
        : `${r.nickname}님의 일지예요. 붙은 사진도 함께 지워져요.`,
      confirmLabel: "지우기",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/reports/${r.id}`, { method: "DELETE" });
      setEditing(null);
      changed("🗑 항해 일지를 지웠어요");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (sub === "bounty" || sub === "stash") {
    const isBounty = sub === "bounty";
    const range = isBounty ? BOUNTY_POST : STASH;
    return (
      <AmountSheet
        title={isBounty ? `💰 현상금 걸기 · ${spot.name}` : `🪙 보물 묻기 · ${spot.name}`}
        description={
          isBounty
            ? "내 두블룬을 현상금으로 걸어요. 다음에 가서 '차단기 그대로 없음'을 확인한 선원이 받아 가요. 정보가 궁금한 곳에 걸어 보세요."
            : "내 두블룬을 이곳에 몰래 묻어요. 다음에 여기 정박한 다른 선원이 발견해서 가져가요. 누가 묻었는지는 찾은 사람만 알아요."
        }
        options={AMOUNTS.filter((n) => n >= range.min && n <= range.max)}
        balance={me?.balance ?? null}
        confirmLabel={isBounty ? "현상금 걸기" : "보물 묻기"}
        onClose={() => setSub(null)}
        onSubmit={async (amount) => {
          await api(`/api/spots/${spot.id}/${sub}`, { method: "POST", json: { amount } });
          changed(isBounty ? `💰 현상금 ${amount}두블룬을 걸었어요` : `🪙 보물 ${amount}두블룬을 묻었어요. 쉿!`);
        }}
      />
    );
  }

  if (editing) {
    return (
      <ReportSheet
        spot={spot}
        editing={editing}
        onClose={() => setEditing(null)}
        onDone={({ closed, photoFailed }) => {
          setEditing(null);
          changed(
            closed
              ? "🚧 차단기 제보가 쌓여 정박지가 닫혔어요"
              : photoFailed
                ? "📜 일지는 고쳤는데 사진을 바꾸지 못했어요"
                : "📜 항해 일지를 고쳤어요",
          );
        }}
      />
    );
  }

  if (sub === "description") {
    return (
      <DescriptionSheet spot={spot} onClose={() => setSub(null)} onDone={() => changed("📝 정박지 소개를 저장했어요")} />
    );
  }

  if (sub === "guard") {
    return <GuardSheet spot={spot} onClose={() => setSub(null)} onDone={() => changed("👮 경비원 메모를 남겼어요")} />;
  }

  if (sub === "nickname") {
    return <NicknameSheet spot={spot} onClose={() => setSub(null)} onDone={() => changed("✨ 전설의 정박지에 별명을 붙였어요")} />;
  }

  return (
    <Sheet
      onClose={onClose}
      title={
        <>
          {spot.legendary && (
            <p className="text-xs font-bold text-gold-400">
              <Px name="sparkle" size="1.15em" /> 전설의 정박지{spot.nickname ? ` · “${spot.nickname}”` : ""}
            </p>
          )}
          <h2 className="truncate text-xl font-black">{spot.name}</h2>
          {spot.address && <p className="truncate text-sm text-slate-400">{spot.address}</p>}
        </>
      }
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <div className={`grid grid-cols-2 gap-2 ${error ? "mt-2" : ""}`}>
            {parkedHere ? (
              <div className="flex min-h-12 items-center justify-center rounded-xl bg-sea-700 font-bold text-gold-400">
                <Px name="anchor" size="1.15em" /> 정박 중
              </div>
            ) : (
              <Button onClick={start} disabled={busy || closed || !!parking}>
                {busy ? "정박 중…" : parking ? "다른 곳 정박 중" : closed ? "닫힌 정박지" : <PxText text="⚓ 정박 시작" />}
              </Button>
            )}
            <Button variant="ghost" onClick={() => onWriteReport(spot)}>
              <Px name="scroll" size="1.15em" /> 일지 쓰기
            </Button>
          </div>
        </>
      }
    >
      {/* 알림 카드들: 중요한 순서 */}
      <div className="space-y-2">
        {closed && <Notice tone="gray"><Px name="gate" size="1.15em" /> 차단기가 생겼다는 제보가 있어 닫힌 정박지예요.</Notice>}
        {spot.navyAlert && (
          <Notice tone="red">
            <Px name="warn" size="1.15em" /> <b>해군 출몰!</b> {spot.navyAlert.by}님이 경계 5를 제보 · {timeAgo(spot.navyAlert.at)}
          </Notice>
        )}
        {spot.kingDomain && (
          <Notice tone="gold">
            <Px name="crown" size="1.15em" /> <b>해적왕의 영지</b> · 지난달 해적왕 {spot.kingDomain.nickname}님이 다스리는 곳
          </Notice>
        )}
        {spot.treasure > 0 && (
          <Notice tone="gold">
            <Px name="chest" size="1.15em" /> <b>오늘의 보물상자</b>가 여기 있어요! 오늘 처음 정박하는 선원이 가져가요.
          </Notice>
        )}
        {spot.bounty > 0 && (
          <Notice tone="green">
            <Px name="coin" size="1.15em" /> <b>현상금 {spot.bounty}두블룬</b>
            {spot.postedBounty > 0 && <span className="text-slate-300"> (선원이 건 {spot.postedBounty} 포함)</span>}
            <span className="text-slate-300"> · &ldquo;차단기 그대로 없음&rdquo; 일지를 쓰면 획득</span>
          </Notice>
        )}
        {spot.parkedCount >= FLEET_SIZE && <Notice tone="sea"><Px name="ship" size="1.15em" /> 함대 집결 중! 지금 정박하면 보너스</Notice>}
        {spot.stashRumor && <Notice tone="sea"><Px name="coin" size="1.15em" /> 소문: 누군가 이곳에 보물을 묻어 뒀대요…</Notice>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="정박 중" value={`${spot.parkedCount}명`} />
        <Stat
          label="경계 레벨"
          value={
            <span style={{ color: guardColor(spot.guardAvg, false) }}>
              {spot.guardAvg == null ? "–" : spot.guardAvg.toFixed(1)}
            </span>
          }
          sub={spot.guardAvg == null ? "정보 없음" : GUARD_LABELS[Math.round(spot.guardAvg)]}
        />
        <Stat label="마지막 확인" value={timeAgo(spot.lastConfirmedAt)} small />
      </div>

      {/* 정박지 소개: 누구나 고칠 수 있음 */}
      <div className="mt-3 rounded-xl bg-sea-800 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300"><Px name="note" size="1.15em" /> 정박지 소개</h3>
          <button onClick={() => setSub("description")} className="-mr-1 h-8 px-2 text-xs font-bold text-gold-400">
            {spot.description ? "고치기" : "쓰기"}
          </button>
        </div>
        {spot.description ? (
          <>
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">{spot.description}</p>
            {spot.descriptionBy && spot.descriptionAt && (
              <p className="mt-1 text-[11px] text-slate-500">
                마지막 수정 {spot.descriptionBy} · {timeAgo(spot.descriptionAt)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-500">입구, 층, 주의할 점 같은 걸 남겨 주세요. 누구나 고칠 수 있어요.</p>
        )}
      </div>

      {/* 경비원 메모: 누구나 추가, 적은 사람·관리자만 삭제 */}
      <div className="mt-3 rounded-xl bg-sea-800 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300"><Px name="guard" size="1.15em" /> 경비원 번호</h3>
          <button onClick={() => setSub("guard")} className="-mr-1 h-8 px-2 text-xs font-bold text-gold-400">
            + 추가
          </button>
        </div>
        {!detail ? (
          <p className="mt-1 text-sm text-slate-500">불러오는 중…</p>
        ) : detail.guards.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">경비원 아저씨 번호 뒷자리를 알면 남겨 주세요.</p>
        ) : (
          <ul className="mt-1 divide-y divide-sea-700">
            {detail.guards.map((g) => (
              <li key={g.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="font-mono text-base font-black tracking-widest text-gold-400">****-{g.digits}</span>
                <span className="min-w-0 flex-1 truncate">{g.label || "경비원"}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{g.nickname}</span>
                {g.canDelete && (
                  <button
                    onClick={() => void deleteGuard(g)}
                    className="-my-1 h-8 shrink-0 px-1 text-[11px] font-bold text-red-400"
                  >
                    지우기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SpotPhotoStrip
        spotId={spot.id}
        photos={detail?.photos ?? null}
        onChanged={(msg) => {
          setReloadKey((k) => k + 1);
          onChanged(msg);
        }}
      />

      {/* 영주 · 발견자 */}
      <div className="mt-3 divide-y divide-sea-700 rounded-xl bg-sea-800 text-sm">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-slate-400"><Px name="castle" size="1.15em" /> 영주</span>
          <span className="font-semibold">
            {spot.lord ? (
              <>
                {spot.kingDomain && <PxText text="👑 " />}
                <PxText text={spot.lord.flag} /> {spot.lord.nickname}
                <span className="ml-1 text-xs font-normal text-slate-400">30일 {spot.lord.count}회</span>
              </>
            ) : (
              <span className="text-slate-500">아직 없음 (30일 2회 이상 정박)</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-slate-400"><Px name="skull" size="1.15em" /> 발견</span>
          <span className="font-semibold">
            {spot.discoverer}
            <span className="ml-1 text-xs font-normal text-slate-400">{timeAgo(spot.createdAt)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-slate-400"><Px name="anchor" size="1.15em" /> 누적 정박</span>
          <span className="font-semibold">
            {spot.totalParkings}회
            {!spot.legendary && (
              <span className="ml-1 text-xs font-normal text-slate-400">전설까지 {LEGEND_PARKINGS - spot.totalParkings}</span>
            )}
          </span>
        </div>
      </div>

      {/* 금화 쓰기 */}
      {!closed && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setSub("bounty")} className="min-h-11 rounded-xl border border-sea-600 text-sm font-bold">
            <Px name="coin" size="1.15em" /> 현상금 걸기
          </button>
          <button onClick={() => setSub("stash")} className="min-h-11 rounded-xl border border-sea-600 text-sm font-bold">
            <Px name="coin" size="1.15em" /> 보물 묻기
          </button>
        </div>
      )}
      {spot.legendary && iAmLord && (
        <button
          onClick={() => setSub("nickname")}
          className="mt-2 min-h-11 w-full rounded-xl border border-gold-400/60 text-sm font-bold text-gold-400"
        >
          <Px name="sparkle" size="1.15em" /> 영주의 권한: 별명 짓기
        </button>
      )}

      <div className="mt-4 pb-1">
        <h3 className="mb-2 text-sm font-bold text-slate-300">
          항해 일지{reports && reports.length > 0 && <span className="ml-1 font-normal text-slate-500">{reports.length}개</span>}
        </h3>
        {reports === null ? (
          <p className="text-sm text-slate-500">불러오는 중…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-500">아직 일지가 없어요. 첫 일지를 남겨 주세요.</p>
        ) : (
          <ul className="space-y-2">
            {(showAllReports ? reports : reports.slice(0, REPORTS_PREVIEW)).map((r) => (
              <li key={r.id} className="rounded-xl bg-sea-800 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                  <b className="text-slate-200">{r.nickname}</b>
                  <span>{timeAgo(r.createdAt)}</span>
                  {r.updatedAt && <span className="text-slate-500">(고침)</span>}
                  {r.guardLevel != null && (
                    <span style={{ color: guardColor(r.guardLevel, false) }}>경계 {r.guardLevel}</span>
                  )}
                  {r.gateStatus === "no_gate" && <span className="text-green-400">차단기 없음</span>}
                  {r.gateStatus === "gate_installed" && <span className="text-red-400">차단기 생김</span>}
                  {(r.mine || r.canDelete) && (
                    <span className="-my-1 ml-auto flex">
                      {r.mine && (
                        <button onClick={() => setEditing(r)} className="h-8 px-1.5 text-[11px] font-bold text-gold-400">
                          고치기
                        </button>
                      )}
                      {r.canDelete && (
                        <button onClick={() => deleteReport(r)} className="h-8 px-1.5 text-[11px] font-bold text-red-400">
                          지우기
                        </button>
                      )}
                    </span>
                  )}
                </div>
                {r.note && <p className="mt-1 text-sm break-words whitespace-pre-wrap">{r.note}</p>}
                {r.photoId && (
                  <button onClick={() => setViewing(r)} className="mt-2 block h-24 w-32 overflow-hidden rounded-lg bg-sea-900">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 로그인 쿠키가 필요한 API 사진 */}
                    <img src={photoUrl(r.photoId)} alt="일지 사진" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                )}
              </li>
            ))}
            {reports.length > REPORTS_PREVIEW && (
              <li>
                <button
                  onClick={() => setShowAllReports((v) => !v)}
                  className="min-h-11 w-full rounded-xl border border-sea-600 text-sm font-bold text-slate-300"
                >
                  {showAllReports ? "접기" : `이전 일지 ${reports.length - REPORTS_PREVIEW}개 더 보기`}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      {viewing?.photoId && (
        <PhotoViewer
          id={viewing.photoId}
          caption={`${viewing.nickname}의 항해 일지 · ${timeAgo(viewing.createdAt)}`}
          onClose={() => setViewing(null)}
        />
      )}
      {confirmNode}
    </Sheet>
  );
}

function Notice({ tone, children }: { tone: "gray" | "red" | "gold" | "green" | "sea"; children: React.ReactNode }) {
  const cls = {
    gray: "bg-slate-700",
    red: "bg-red-600",
    gold: "border border-gold-400/50 bg-gold-400/15",
    green: "border border-green-500/50 bg-green-500/15",
    sea: "bg-sea-700",
  }[tone];
  return <div className={`rounded-xl px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

function Stat({ label, value, sub, small }: { label: string; value: React.ReactNode; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-sea-800 px-2 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 font-black ${small ? "text-sm" : "text-lg"}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function NicknameSheet({ spot, onClose, onDone }: { spot: SpotSummary; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(spot.nickname ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet
      onClose={onClose}
      title={<h2 className="text-lg font-black"><Px name="sparkle" size="1.15em" /> 전설의 정박지 별명</h2>}
      footer={
        <Button
          className="w-full"
          disabled={busy || name.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api(`/api/spots/${spot.id}/nickname`, { method: "POST", json: { nickname: name } });
              onDone();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "저장 중…" : "별명 붙이기"}
        </Button>
      }
    >
      <p className="mb-2 text-sm text-slate-300">
        {spot.name}은(는) 누적 정박 {LEGEND_PARKINGS}회를 넘긴 전설의 정박지예요. 영주로서 별명을 지어 주세요.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 16))}
        placeholder="예: 해적의 안식처"
        className="h-12 w-full rounded-xl border border-sea-600 bg-sea-800 px-4 text-white outline-none focus:border-gold-400"
      />
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

function DescriptionSheet({ spot, onClose, onDone }: { spot: SpotSummary; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(spot.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet
      onClose={onClose}
      title={
        <>
          <p className="text-xs text-slate-400"><Px name="note" size="1.15em" /> 정박지 소개</p>
          <h2 className="truncate text-lg font-black">{spot.name}</h2>
        </>
      }
      footer={
        <Button
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api(`/api/spots/${spot.id}/description`, { method: "POST", json: { description: text } });
              onDone();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "저장 중…" : "저장"}
        </Button>
      }
    >
      <p className="mb-2 text-xs text-slate-400">
        항해 일지와 달리 한 곳에 하나만 있는 설명이에요. 누구나 고칠 수 있고, 마지막으로 고친 선원이 표시돼요.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, DESCRIPTION_MAX))}
        rows={6}
        placeholder={"예:\n- 정문 말고 후문 입구로\n- 지하 1층 방문자 칸 넉넉함\n- 밤 11시 이후 경비 순찰"}
        className="w-full rounded-xl border border-sea-600 bg-sea-800 px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-gold-400"
      />
      <div className="mt-1 pb-1 text-right text-xs text-slate-500">
        {text.length}/{DESCRIPTION_MAX}
      </div>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}

function GuardSheet({ spot, onClose, onDone }: { spot: SpotSummary; onClose: () => void; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet
      onClose={onClose}
      title={
        <>
          <p className="text-xs text-slate-400"><Px name="guard" size="1.15em" /> 경비원 번호</p>
          <h2 className="truncate text-lg font-black">{spot.name}</h2>
        </>
      }
      footer={
        <Button
          className="w-full"
          disabled={busy || digits.length !== 4}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api(`/api/spots/${spot.id}/guards`, { method: "POST", json: { label, digits } });
              onDone();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "저장 중…" : "남기기"}
        </Button>
      }
    >
      <label className="block text-sm font-bold text-slate-300">
        번호 뒷자리 4자리
        <input
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="1234"
          className="mt-1 h-12 w-full rounded-xl border border-sea-600 bg-sea-800 px-4 font-mono text-xl tracking-[0.3em] text-white outline-none focus:border-gold-400"
        />
      </label>
      <label className="mt-3 block text-sm font-bold text-slate-300">
        메모 <span className="font-normal text-slate-500">(선택)</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, GUARD_LABEL_MAX))}
          placeholder="예: 야간 아저씨, 정문 초소"
          className="mt-1 h-12 w-full rounded-xl border border-sea-600 bg-sea-800 px-4 text-white outline-none focus:border-gold-400"
        />
      </label>
      <p className="mt-2 pb-1 text-xs text-slate-500">전체 번호는 남기지 말고 뒷자리 4자리만 적어요. 선원들만 볼 수 있어요.</p>
      <ErrorText>{error}</ErrorText>
    </Sheet>
  );
}
