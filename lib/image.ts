import { PHOTO_MAX_BYTES, PHOTO_MAX_EDGE } from "./game";

export type Compressed = { blob: Blob; width: number; height: number };

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // createImageBitmap은 사진의 회전 정보(EXIF orientation)를 적용해서 그려 준다
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* 아래 방식으로 */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/**
 * 사진을 긴 변 1280px JPEG로 다시 그린다.
 * 캔버스로 새로 그리기 때문에 원본의 EXIF(찍은 위치 GPS, 기기 정보)는 모두 사라진다.
 */
export async function compressImage(file: File): Promise<Compressed> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("사진 파일만 올릴 수 있어요.");
  }
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error("이 사진 형식은 열 수 없어요. 다른 사진을 골라 주세요.");
  }
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("사진을 처리하지 못했어요.");
  ctx.drawImage(decoded.source, 0, 0, width, height);
  decoded.close();

  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= PHOTO_MAX_BYTES) return { blob, width, height };
  }
  throw new Error("사진을 충분히 줄이지 못했어요. 다른 사진을 골라 주세요.");
}

/** 사진 올리기. reportId가 있으면 항해 일지 사진, 없으면 정박지 소개 사진 */
export async function uploadPhoto(spotId: string, file: File, reportId?: string): Promise<string> {
  const { blob, width, height } = await compressImage(file);
  const form = new FormData();
  form.set("file", blob, "photo.jpg");
  form.set("spotId", spotId);
  form.set("width", String(width));
  form.set("height", String(height));
  if (reportId) form.set("reportId", reportId);
  const res = await fetch("/api/photos", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "사진을 올리지 못했어요.");
  return data.id as string;
}
