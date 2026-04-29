import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "How it works · TTB Label Verifier",
  description: "How the verifier compares your application data against the label artwork.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="type-display text-ink">How this tool works</h1>
        <p className="type-body text-graphite">
          A reviewer-friendly walkthrough of what the verifier checks, where the AI helps, and where
          it deliberately stays out of the way.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="type-headline text-ink">What you put in</h2>
        <p className="type-body text-ink">
          You upload a single label image (JPG or PNG, up to 5 MB) and the same fields you would
          submit on a TTB COLA form: brand name, class/type, alcohol content, net contents, and any
          bottler / importer / country-of-origin details that apply.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-headline text-ink">What the AI does</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 type-body text-ink">
          <li>
            <strong>Read the label.</strong> Claude Haiku 4.5 extracts the printed fields exactly as
            written. It never sees your application data, only the picture.
          </li>
          <li>
            <strong>Read the warning.</strong> Claude Sonnet 4.5 captures the Government Health
            Warning text and notes whether the header is ALL CAPS and visually bold.
          </li>
          <li>
            <strong>Re-read uncertain fields.</strong> If Haiku reports low confidence on a field,
            Sonnet looks at that one field again with extra care.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-headline text-ink">What the server does</h2>
        <p className="type-body text-ink">
          A deterministic matcher (no LLM in the verdict path) compares each extracted field to your
          application after normalizing case, smart quotes, whitespace, and obvious spelling
          variants. Numbers like ABV and net contents are compared numerically. Addresses are
          compared as token sets.
        </p>
        <p className="type-body text-ink">
          The Government Health Warning is checked against the canonical text from{" "}
          <span className="type-mono text-ink underline decoration-rust decoration-1 underline-offset-2">
            27 CFR 16.21
          </span>{" "}
          with a strict string equality test. The header must be ALL CAPS and bold. No paraphrasing
          is allowed.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-headline text-ink">What you see</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 type-body text-ink">
          <li>
            A clear <strong>PASS / REVIEW / FAIL</strong> banner with a one-line explanation.
          </li>
          <li>A field-by-field table showing your value, the label's value, and the verdict.</li>
          <li>For the warning, a side-by-side red-line showing exactly what differs.</li>
          <li>
            A one-click <em>Explain this</em> button on every failure so a reviewer can hand the
            file back to the applicant in plain English.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-headline text-ink">What we don't do</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 type-body text-ink">
          <li>We do not store your label images or application data on the server.</li>
          <li>We do not ask the AI to make pass/fail decisions — only to read text.</li>
          <li>We do not auto-approve anything. A human reviewer is always in the loop.</li>
        </ul>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-ledger bg-bone p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="type-title text-ink">Ready to try it?</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Verify a single label
          </Link>
          <Link href="/batch" className={buttonVariants({ variant: "outline" })}>
            Or run a batch
          </Link>
        </div>
      </div>
    </main>
  );
}
