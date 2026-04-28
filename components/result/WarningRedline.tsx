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
    <section className="flex flex-col gap-3 rounded-lg border p-5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Government health warning</h3>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium",
            passed
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-900",
          )}
        >
          {passed ? "Compliant" : "Non-compliant"}
        </span>
      </header>

      {!passed && warning.failures.length ? (
        <ul className="list-inside list-disc space-y-1 text-sm text-red-900">
          {warning.failures.map((f) => (
            <li key={`${f.kind}:${f.detail}`}>{f.detail}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      <p className="whitespace-normal break-words rounded-md border bg-slate-50 p-3 font-mono text-sm leading-relaxed">
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
            <ins key={key} className="bg-red-200 text-red-900 no-underline">
              {part.value}
            </ins>
          );
        }
        if (part.removed) {
          return (
            <del key={key} className="bg-amber-200 text-amber-900">
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
    <p className="flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={cn("inline-block size-2.5 rounded-full", ok ? "bg-green-600" : "bg-red-600")}
      />
      <span>{label}</span>
      <span className={cn("font-medium", ok ? "text-green-700" : "text-red-700")}>
        {ok ? "OK" : "Failed"}
      </span>
    </p>
  );
}
