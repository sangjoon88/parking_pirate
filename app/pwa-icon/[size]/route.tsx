import { renderIcon } from "@/lib/icon";

const SIZES = ["192", "512", "maskable-512"] as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  if (size === "maskable-512") return renderIcon(512, { maskable: true });
  return renderIcon(size === "192" ? 192 : 512);
}
