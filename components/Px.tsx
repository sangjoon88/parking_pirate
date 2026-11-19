import { PX_PALETTE, pxRows, type PxName } from "@/lib/pixelIcons";

/**
 * 도트 아이콘. size는 가로 픽셀(CSS px). 글자 줄 높이에 맞춰 세로 가운데 정렬.
 * 같은 색이 이어지면 사각형 하나로 합쳐 그린다.
 */
export default function Px({
  name,
  size = 20,
  className = "",
  title,
}: {
  name: PxName;
  /** 숫자는 px, 문자열은 CSS 길이 (예: "1.15em") */
  size?: number | string;
  className?: string;
  title?: string;
}) {
  const rows = pxRows(name);
  const w = rows[0].length;
  const h = rows.length;
  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const ch = row[x];
      const fill = PX_PALETTE[ch];
      if (!fill) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < w && row[x + run] === ch) run++;
      rects.push(<rect key={`${x},${y}`} x={x} y={y} width={run} height={1} fill={fill} />);
      x += run;
    }
  });
  return (
    <svg
      width={size}
      height={typeof size === "number" ? (size * h) / w : `calc(${size} * ${h / w})`}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={`inline-block shrink-0 align-[-0.2em] ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}
