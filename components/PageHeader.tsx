export default function PageHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-10 bg-sea-950/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-5">
        <h1 className="text-xl font-black">{title}</h1>
        {right}
      </div>
    </header>
  );
}
