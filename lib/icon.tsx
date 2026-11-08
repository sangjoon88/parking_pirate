import { ImageResponse } from "next/og";

/** 앱 아이콘: 남색 바탕 + 금색 엇갈린 뼈 + P (주차) */
export function renderIcon(size: number, { maskable = false } = {}) {
  const pad = maskable ? size * 0.12 : 0; // maskable은 안전 영역 확보
  const inner = size - pad * 2;
  const bar = { width: inner * 0.82, height: inner * 0.11, borderRadius: inner * 0.06, background: "#f5c451" };
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07111f",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div style={{ position: "relative", width: inner, height: inner, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", ...bar, transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", ...bar, transform: "rotate(-45deg)" }} />
          <div
            style={{
              width: inner * 0.56,
              height: inner * 0.56,
              borderRadius: "50%",
              background: "#0b1a2e",
              border: `${Math.max(2, inner * 0.04)}px solid #f5c451`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f5c451",
              fontSize: inner * 0.36,
              fontWeight: 800,
            }}
          >
            P
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
