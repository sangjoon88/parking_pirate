import { colorOf } from "@/lib/game";

/**
 * 닉네임 + 상점에서 산 색·효과.
 * 효과(반짝이·후광·물결빛)는 색이 있을 때만 붙는다 (서버에서도 색 없이는 못 산다).
 */
export default function Nickname({
  name,
  color,
  effect,
  className = "",
}: {
  name: string;
  color?: string | null;
  effect?: string | null;
  className?: string;
}) {
  const c = colorOf(color);
  const fx = c && effect ? `nick-fx nick-${effect}` : "";
  return (
    <span className={`${fx} ${className}`} style={c ? ({ color: c, "--nick": c } as React.CSSProperties) : undefined}>
      {name}
    </span>
  );
}
