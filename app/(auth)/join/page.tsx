import JoinForm from "./JoinForm";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <JoinForm initialCode={code ?? ""} />;
}
