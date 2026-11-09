/* eslint-disable @next/next/no-img-element -- ImageResponse(satori) 안에서 쓰는 img */
import { ImageResponse } from "next/og";
import { iconSvg } from "./pixelArt";

/** 앱 아이콘: 픽셀 해적기 (스플래시와 같은 그림) */
export function renderIcon(size: number, { maskable = false } = {}) {
  const svg = iconSvg(size, { maskable, rounded: !maskable });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "transparent" }}>
        <img src={src} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
