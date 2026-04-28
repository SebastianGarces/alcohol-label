import { BatchClient } from "@/components/batch/BatchClient";

export const metadata = {
  title: "Batch · TTB Label Verifier",
  description: "Verify hundreds of labels at once with a single CSV.",
};

export default function BatchPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">Batch verification</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Drop label images and a CSV of application data. We'll match them by filename, run them
          through the verifier six at a time, and let you sort, filter, and export the results.
          Built for the Janet-in-Seattle case from the brief.
        </p>
      </header>
      <BatchClient />
      <section className="rounded-2xl border bg-slate-50 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">CSV format</p>
        <p className="mt-1">
          Header row, columns:
          <code className="ml-1 break-all rounded bg-white px-2 py-0.5 text-xs">
            filename, beverageType, brandName, classType, alcoholContent, netContents, bottlerName,
            bottlerAddress, importerName, importerAddress, countryOfOrigin
          </code>
        </p>
        <p className="mt-2">
          Beverage type is one of <code>distilled_spirits</code>, <code>wine</code>,{" "}
          <code>malt_beverage</code>. Filename matching is case-insensitive.
        </p>
      </section>
    </main>
  );
}
