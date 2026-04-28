export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">TTB Label Verifier</h1>
      <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
        Compare alcohol label artwork against your application data. Upload a label image and a few
        application fields, and we&apos;ll flag mismatches before TTB does.
      </p>
      <p className="text-sm text-muted-foreground">
        Phase 1 placeholder. Single-label flow ships in Phase 2.
      </p>
    </main>
  );
}
