import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { VerifierClient } from "@/components/verifier/VerifierClient";
import { SampleManifest } from "@/lib/schema/sample";

async function loadSamples() {
  try {
    const buf = await readFile(join(process.cwd(), "public/samples/samples.json"), "utf8");
    return SampleManifest.parse(JSON.parse(buf));
  } catch {
    return [];
  }
}

export default async function Home() {
  const samples = await loadSamples();
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="type-display text-ink">TTB Label Verifier</h1>
        <p className="type-body max-w-2xl text-graphite">
          Compare alcohol label artwork to the COLA application data. Upload a label, fill in the
          application fields, and the verifier returns a field-by-field breakdown of every mismatch
          and warning-statement issue.
        </p>
      </header>
      <VerifierClient samples={samples} />
    </main>
  );
}
