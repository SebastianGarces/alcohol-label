import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ledger bg-bone">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-2 px-6 py-4 text-base text-graphite sm:flex-row sm:items-center">
        <p>
          Verification by deterministic comparison. AI reads the label; the system makes the call.{" "}
          <Link
            href="/about"
            className="font-medium text-ink underline decoration-rust decoration-1 underline-offset-2 hover:decoration-2"
          >
            How it works
          </Link>
          .
        </p>
        <p>No labels are stored on the server.</p>
      </div>
    </footer>
  );
}
