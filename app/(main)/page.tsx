import MapScreen from "@/components/MapScreen";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ fog?: string }> }) {
  const { fog } = await searchParams;
  return <MapScreen initialFog={fog === "1"} />;
}
