import { diffWords } from "diff";
import type { WarningResult } from "@/lib/schema/result";
import { cn } from "@/lib/utils";
import { ExplainRejection } from "./ExplainRejection";

export function WarningRedline({
  warning,
  resultId,
}: {
  warning: WarningResult;
  resultId: string;
}) {
  const passed = warning.status === "pass";
  return (
    <section className="@container/redline flex flex-col gap-3 rounded-md border border-ledger bg-paper p-5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="type-title text-ink">Government health warning</h3>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium",
            passed
              ? "border-pass-rule bg-pass-tint text-pass-ink"
              : "border-fail-rule bg-fail-tint text-fail-ink",
          )}
        >
          {passed ? "Compliant" : "Non-compliant"}
        </span>
      </header>

      {!passed && warning.failures.length ? (
        <ul className="list-inside list-disc space-y-1 text-base text-fail-ink">
          {warning.failures.map((f) => (
            <li key={`${f.kind}:${f.detail}`}>{f.detail}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-1 gap-4 @2xl/redline:grid-cols-2">
        <Block title="Canonical (27 CFR 16.21)" body={warning.canonicalText} />
        <Block
          title="Read from label"
          body={warning.extractedText ?? "(not detected)"}
          diffAgainst={passed ? null : warning.canonicalText}
        />
      </div>

      <FlagRow label="Header is ALL CAPS" ok={warning.headerIsAllCaps} />
      <FlagRow label="Header is bold" ok={warning.headerAppearsBold} />

      {!passed ? (
        <ExplainRejection
          resultId={resultId}
          scope="warning"
          payload={{
            kind: "warning",
            failures: warning.failures,
            extractedText: warning.extractedText,
            canonicalText: warning.canonicalText,
          }}
        />
      ) : null}
    </section>
  );
}

function Block({
  title,
  body,
  diffAgainst,
}: {
  title: string;
  body: string;
  diffAgainst?: string | null;
}) {
  return (
    <article className="flex flex-col gap-2">
      <h4 className="type-label text-pencil">{title}</h4>
      <p className="type-mono whitespace-normal break-words rounded-sm border border-ledger bg-bone p-3 text-ink">
        {diffAgainst ? <Diff before={diffAgainst} after={body} /> : body}
      </p>
    </article>
  );
}

function Diff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  let cursor = 0;
  return (
    <>
      {parts.map((part) => {
        const key = `${cursor}:${part.added ? "+" : part.removed ? "-" : "="}:${part.value}`;
        cursor += part.value.length;
        if (part.added) {
          return (
            <ins
              key={key}
              className="bg-fail-tint text-fail-ink underline decoration-rust decoration-1 underline-offset-2"
            >
              {part.value}
            </ins>
          );
        }
        if (part.removed) {
          return (
            <del
              key={key}
              className="bg-review-tint text-review-ink decoration-review-ink decoration-1"
            >
              {part.value}
            </del>
          );
        }
        return <span key={key}>{part.value}</span>;
      })}
    </>
  );
}

function FlagRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <p className="flex items-center gap-2 text-base">
      <span
        aria-hidden
        className={cn("inline-block size-2.5 rounded-full", ok ? "bg-pass-ink" : "bg-fail-ink")}
      />
      <span className="text-ink">{label}</span>
      <span className={cn("font-medium", ok ? "text-pass-ink" : "text-fail-ink")}>
        {ok ? "OK" : "Failed"}
      </span>
    </p>
  );
}
