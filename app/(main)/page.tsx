import MapScreen from "@/components/MapScreen";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ fog?: string; spot?: string }> }) {
  const { fog, spot } = await searchParams;
  return <MapScreen initialFog={fog === "1"} initialSpotId={spot ?? null} />;
}
