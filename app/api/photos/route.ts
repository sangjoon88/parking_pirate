import { and, count, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { photos, spotReports, spots } from "@/db/schema";
import { bad, handle, requireUser } from "@/lib/auth";
import { PHOTO_MAX_BYTES, PHOTO_TOTAL_MAX_BYTES, SPOT_PHOTO_MAX } from "@/lib/game";

const UUID = /^[0-9a-f-]{36}$/i;

/** 파일 앞부분으로 실제 이미지 형식 확인 (확장자·Content-Type만 믿지 않는다) */
function sniff(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

/**
 * 사진 올리기 (multipart/form-data)
 * - file: 이미지 (브라우저에서 줄이고 EXIF를 지운 JPEG)
 * - spotId: 정박지
 * - reportId: 있으면 항해 일지 사진 (내가 쓴 일지에만, 1장), 없으면 정박지 소개 사진
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    bad("사진을 읽지 못했어요.");
  }
  const file = form.get("file");
  const spotId = String(form.get("spotId") ?? "");
  const reportId = form.get("reportId") ? String(form.get("reportId")) : null;
  const width = Number(form.get("width")) || null;
  const height = Number(form.get("height")) || null;

  if (!(file instanceof Blob)) bad("사진 파일이 없어요.");
  if (file.size > PHOTO_MAX_BYTES) bad("사진이 너무 커요. 다시 시도해 주세요.");
  if (!UUID.test(spotId) || (reportId && !UUID.test(reportId))) bad("잘못된 요청이에요.");

  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniff(data);
  if (!mime) bad("JPEG·PNG·WebP 사진만 올릴 수 있어요.");

  const [spot] = await db.select({ id: spots.id }).from(spots).where(eq(spots.id, spotId)).limit(1);
  if (!spot) bad("정박지를 찾을 수 없어요.", 404);

  if (reportId) {
    const [report] = await db
      .select({ userId: spotReports.userId, spotId: spotReports.spotId })
      .from(spotReports)
      .where(eq(spotReports.id, reportId))
      .limit(1);
    if (!report || report.spotId !== spotId) bad("항해 일지를 찾을 수 없어요.", 404);
    if (report.userId !== user.id) bad("내가 쓴 일지에만 사진을 붙일 수 있어요.", 403);
    const [had] = await db.select({ id: photos.id }).from(photos).where(eq(photos.reportId, reportId)).limit(1);
    if (had) bad("일지 사진은 한 장만 붙일 수 있어요.");
  } else {
    const [row] = await db
      .select({ n: count() })
      .from(photos)
      .where(and(eq(photos.spotId, spotId), isNull(photos.reportId)));
    if ((row?.n ?? 0) >= SPOT_PHOTO_MAX) bad(`정박지 사진은 ${SPOT_PHOTO_MAX}장까지예요. 오래된 사진을 지워 주세요.`);
  }

  // 전체 용량 상한 (Neon 무료 용량 보호)
  const total = await db.execute<{ t: string | number }>(sql`select coalesce(sum(size), 0) as t from photos`);
  if (Number(total.rows[0]?.t ?? 0) + data.length > PHOTO_TOTAL_MAX_BYTES) {
    bad("사진 저장 공간이 가득 찼어요. 관리자에게 알려 주세요.");
  }

  const [created] = await db
    .insert(photos)
    .values({ spotId, reportId, userId: user.id, mime, data, size: data.length, width, height })
    .returning({ id: photos.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
});
