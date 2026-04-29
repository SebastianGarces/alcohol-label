import { BatchClient } from "@/components/batch/BatchClient";

export const metadata = {
  title: "Batch · TTB Label Verifier",
  description: "Verify hundreds of labels at once with a single CSV.",
};

export default function BatchPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="type-display text-ink">Batch verification</h1>
        <p className="type-body max-w-2xl text-graphite">
          Drop label images and a CSV of application data. The verifier matches them by filename,
          runs them six at a time, and lets you sort, filter, and export the results when the queue
          is done.
        </p>
      </header>
      <BatchClient />
      <section className="rounded-xl border border-ledger bg-bone p-5 text-base text-graphite">
        <p className="type-title text-ink">CSV format</p>
        <p className="mt-2">
          Header row, columns:{" "}
          <code className="type-mono break-all rounded-sm bg-paper px-2 py-0.5 text-ink">
            filename, beverageType, brandName, classType, alcoholContent, netContents, bottlerName,
            bottlerAddress, importerName, importerAddress, countryOfOrigin
          </code>
        </p>
        <p className="mt-2">
          Beverage type is one of <code className="type-mono text-ink">distilled_spirits</code>,{" "}
          <code className="type-mono text-ink">wine</code>,{" "}
          <code className="type-mono text-ink">malt_beverage</code>. Filename matching is
          case-insensitive.
        </p>
      </section>
    </main>
  );
}
