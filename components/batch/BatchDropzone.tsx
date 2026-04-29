"use client";

import { FileSpreadsheet, Images } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

export type DropPayload = {
  images: File[];
  csv: File | null;
};

export function BatchDropzone({
  onDrop,
  images,
  csv,
}: {
  onDrop: (payload: DropPayload) => void;
  images: File[];
  csv: File | null;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    noClick: false,
    onDrop: (accepted) => {
      const nextImages: File[] = [];
      let nextCsv: File | null = null;
      for (const file of accepted) {
        if (
          file.type === "text/csv" ||
          file.name.toLowerCase().endsWith(".csv") ||
          file.type === "application/vnd.ms-excel"
        ) {
          nextCsv = file;
        } else if (file.type.startsWith("image/")) {
          nextImages.push(file);
        }
      }
      onDrop({
        images: [...images, ...nextImages],
        csv: nextCsv ?? csv,
      });
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div
        {...getRootProps({
          className: cn(
            "flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border p-10 text-center transition focus-within:ring-2 focus-within:ring-rust",
            isDragActive
              ? "border-rust bg-rust-tint"
              : "cursor-pointer border-ledger bg-bone hover:bg-bone/80",
          ),
        })}
      >
        <input {...getInputProps()} aria-label="Upload images and CSV" />
        <div className="flex items-center gap-4 text-pencil">
          <Images aria-hidden className="size-10" />
          <FileSpreadsheet aria-hidden className="size-10" />
        </div>
        <p className="text-base font-medium text-ink">
          Drop label images and one CSV here, or click to browse
        </p>
        <p className="text-base text-graphite">
          The verifier matches images to rows by{" "}
          <code className="type-mono text-ink">filename</code>, case-insensitive.
        </p>
      </div>
      <p className="text-base text-graphite">
        {images.length} image{images.length === 1 ? "" : "s"} ·{" "}
        {csv ? `CSV: ${csv.name}` : "no CSV yet"}
      </p>
    </div>
  );
}
