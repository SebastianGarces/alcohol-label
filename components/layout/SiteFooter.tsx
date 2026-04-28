export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-2 px-6 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <p>Powered by Claude (Haiku 4.5 + Sonnet 4.5) via OpenRouter.</p>
        <p>No labels are stored on the server.</p>
      </div>
    </footer>
  );
}
