import { EMOJI_RE, emojiToPx } from "@/lib/emojiPx";
import Px from "./Px";

/** 문자열 속 이모지를 도트 아이콘으로 바꿔 보여 준다 (알림·확인창·탭 이름 등) */
export default function PxText({ text, size = "1.15em" }: { text: string; size?: number | string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const name = emojiToPx(m[1]);
    if (!name) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(<Px key={m.index} name={name} size={size} />);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
