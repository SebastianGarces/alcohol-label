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
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          TTB Label Verifier
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Compare alcohol label artwork to your application data. Upload a label and a few fields,
          and we'll surface mismatches and warning-statement issues before TTB does.
        </p>
      </header>
      <VerifierClient samples={samples} />
    </main>
  );
}
