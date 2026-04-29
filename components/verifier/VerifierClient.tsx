"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { verifyLabelAction } from "@/app/actions";
import { ResultDisplay } from "@/components/result/ResultDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelDropzone } from "@/components/upload/LabelDropzone";
import type { BeverageType } from "@/lib/schema/application";
import type { VerificationResult } from "@/lib/schema/result";
import type { Sample } from "@/lib/schema/sample";
import { resizeImageForUpload } from "@/lib/upload/resize";
import { cn } from "@/lib/utils";

const FormSchema = z.object({
  beverageType: z.enum(["distilled_spirits", "wine", "malt_beverage"]),
  brandName: z.string().trim().min(1, "Required"),
  classType: z.string().trim().min(1, "Required"),
  alcoholContent: z.string().optional().or(z.literal("")),
  netContents: z.string().trim().min(1, "Required"),
  bottlerName: z.string().optional().or(z.literal("")),
  bottlerAddress: z.string().optional().or(z.literal("")),
  importerName: z.string().optional().or(z.literal("")),
  importerAddress: z.string().optional().or(z.literal("")),
  countryOfOrigin: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof FormSchema>;

const STATUS_TEXT = ["Reading label…", "Verifying warning…", "Comparing fields…"];

const BEVERAGE_OPTIONS: { value: BeverageType; label: string }[] = [
  { value: "distilled_spirits", label: "Distilled spirits" },
  { value: "wine", label: "Wine" },
  { value: "malt_beverage", label: "Malt beverage (beer)" },
];

export function VerifierClient({ samples }: { samples: Sample[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [status, setStatus] = useState(STATUS_TEXT[0]);
  const [pending, startTransition] = useTransition();
  const [showSamples, setShowSamples] = useState(false);
  const beverageId = useId();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      beverageType: "distilled_spirits",
      brandName: "",
      classType: "",
      alcoholContent: "",
      netContents: "",
      bottlerName: "",
      bottlerAddress: "",
      importerName: "",
      importerAddress: "",
      countryOfOrigin: "",
    },
  });

  useEffect(() => {
    if (!pending) return;
    let i = 0;
    const t = setInterval(() => {
      i = Math.min(i + 1, STATUS_TEXT.length - 1);
      setStatus(STATUS_TEXT[i]!);
    }, 1500);
    return () => clearInterval(t);
  }, [pending]);

  async function loadSample(s: Sample) {
    try {
      const res = await fetch(`/samples/${s.filename}`);
      const blob = await res.blob();
      const f = new File([blob], s.filename, { type: blob.type || "image/jpeg" });
      setFile(f);
      form.reset({
        beverageType: s.applicationData.beverageType,
        brandName: s.applicationData.brandName ?? "",
        classType: s.applicationData.classType ?? "",
        alcoholContent: s.applicationData.alcoholContent ?? "",
        netContents: s.applicationData.netContents ?? "",
        bottlerName: s.applicationData.bottlerName ?? "",
        bottlerAddress: s.applicationData.bottlerAddress ?? "",
        importerName: s.applicationData.importerName ?? "",
        importerAddress: s.applicationData.importerAddress ?? "",
        countryOfOrigin: s.applicationData.countryOfOrigin ?? "",
      });
      setShowSamples(false);
      toast.success(`Loaded sample: ${s.label}`);
    } catch {
      toast.error("Could not load sample image.");
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!file) {
      toast.error("Please attach a label image first.");
      return;
    }
    setResult(null);
    setStatus(STATUS_TEXT[0]!);
    startTransition(async () => {
      const compressed = await resizeImageForUpload(file);
      const fd = new FormData();
      fd.set("image", compressed);
      for (const [k, v] of Object.entries(values)) {
        fd.set(k, v ?? "");
      }
      const out = await verifyLabelAction(fd);
      if (!out.ok) {
        toast.error(out.error.message);
        return;
      }
      setResult(out.value);
    });
  });

  const beverageType = form.watch("beverageType");
  const isWine = beverageType === "wine";
  const isBeer = beverageType === "malt_beverage";

  const abvHint = useMemo(() => {
    if (isWine) return "Optional for wines ≤14% ABV.";
    if (isBeer) return "Optional unless required by state law.";
    return 'Required. Format: "45%" or "45% alc/vol".';
  }, [isBeer, isWine]);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <form
        onSubmit={onSubmit}
        className="@container/form flex flex-col gap-6 rounded-xl border border-ledger bg-paper p-6 shadow-card"
      >
        <header className="flex flex-col gap-2">
          <h2 className="type-title text-ink">Application data</h2>
          <p className="text-base text-graphite">
            Fill in what you submitted on the COLA form, then attach the label artwork.
          </p>
        </header>

        <fieldset className="flex flex-col gap-3">
          <legend id={beverageId} className="text-base font-medium text-ink">
            Beverage type
          </legend>
          <div
            className="grid grid-cols-1 gap-2 @2xl/form:grid-cols-3"
            role="radiogroup"
            aria-labelledby={beverageId}
          >
            {BEVERAGE_OPTIONS.map((opt) => {
              const checked = beverageType === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-base font-medium transition",
                    checked
                      ? "border-rust bg-rust-tint text-ink"
                      : "border-ledger text-ink hover:bg-bone",
                  )}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    {...form.register("beverageType")}
                    className="size-4 accent-rust"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label="Brand name"
          required
          {...form.register("brandName")}
          error={form.formState.errors.brandName?.message}
        />
        <Field
          label="Class / type"
          required
          {...form.register("classType")}
          error={form.formState.errors.classType?.message}
        />
        <Field label="Alcohol content" hint={abvHint} {...form.register("alcoholContent")} />
        <Field
          label="Net contents"
          required
          hint='e.g. "750 mL"'
          {...form.register("netContents")}
          error={form.formState.errors.netContents?.message}
        />

        <details className="@container/morefields rounded-md border border-ledger bg-bone p-4 text-base">
          <summary className="cursor-pointer font-medium text-ink">
            More fields (optional, 5)
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 @md/morefields:grid-cols-2">
            <Field label="Bottler name" {...form.register("bottlerName")} />
            <Field label="Bottler address" {...form.register("bottlerAddress")} />
            <Field label="Importer name" {...form.register("importerName")} />
            <Field label="Importer address" {...form.register("importerAddress")} />
            <Field label="Country of origin" {...form.register("countryOfOrigin")} />
          </div>
        </details>

        <div className="flex flex-col gap-3">
          <Label className="text-base font-medium text-ink">Label image</Label>
          <LabelDropzone file={file} onFile={setFile} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowSamples((s) => !s)}
            className="gap-2"
          >
            <Sparkles className="size-4" />
            {showSamples ? "Hide samples" : "Try a sample"}
          </Button>
          <Button type="submit" disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? status : "Verify label"}
          </Button>
        </div>

        {showSamples ? (
          <ul className="grid grid-cols-1 gap-1 rounded-md border border-ledger bg-bone p-2 text-base">
            {samples.map((s) => (
              <li key={s.filename}>
                <button
                  type="button"
                  onClick={() => loadSample(s)}
                  className="flex w-full items-baseline gap-3 rounded-sm p-2.5 text-left hover:bg-paper"
                >
                  <span className="font-medium text-ink">{s.label}</span>
                  <span className="type-label text-pencil">expected: {s.expectedStatus}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      <section className="flex flex-col gap-4" aria-live="polite" aria-busy={pending}>
        {result ? (
          <ResultDisplay
            result={result}
            onRetry={() => {
              setResult(null);
              setFile(null);
            }}
          />
        ) : pending ? (
          <div className="flex flex-col gap-4 rounded-xl border border-ledger bg-bone p-8">
            <div className="flex items-center gap-3">
              <Loader2 aria-hidden className="size-6 animate-spin text-graphite" />
              <p className="text-base font-medium text-ink">{status}</p>
            </div>
            <p className="text-base text-graphite">Usually under 5 seconds. Hang tight.</p>
            <div className="flex flex-col gap-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-ledger" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ledger" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-ledger" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-ledger bg-bone p-8 text-graphite">
            <p className="type-title text-ink">Result will appear here.</p>
            <p className="text-base">
              You'll see PASS / REVIEW / FAIL with a field-by-field breakdown and the warning
              red-line. Every flagged item gets a one-click plain-English explanation.
            </p>
            <ul className="flex list-inside list-disc flex-col gap-1 text-base">
              <li>Have a label handy? Drop the image into the upload area on the left.</li>
              <li>
                Just exploring? Click <span className="font-medium text-ink">Try a sample</span> to
                load a pre-filled example.
              </li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
};

const Field = ({ label, required, hint, error, ...props }: FieldProps) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-base font-medium text-ink">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-fail-ink">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </Label>
      <Input
        id={id}
        {...props}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
      />
      {error ? (
        <p id={`${id}-hint`} className="text-sm text-fail-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-graphite">
          {hint}
        </p>
      ) : null}
    </div>
  );
};
