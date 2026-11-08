import { renderIcon } from "@/lib/icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // iOS는 모서리를 직접 둥글게 깎으므로 꽉 찬 사각형으로
  return renderIcon(180, { maskable: true });
}
