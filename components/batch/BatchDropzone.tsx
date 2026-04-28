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
            "flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition focus-within:ring-2 focus-within:ring-primary",
            isDragActive
              ? "border-primary bg-primary/5"
              : "cursor-pointer border-slate-300 bg-slate-50 hover:bg-slate-100",
          ),
        })}
      >
        <input {...getInputProps()} aria-label="Upload images and CSV" />
        <div className="flex items-center gap-4 text-slate-500">
          <Images aria-hidden className="size-10" />
          <FileSpreadsheet aria-hidden className="size-10" />
        </div>
        <p className="text-base font-medium">
          Drop label images and one CSV here, or click to browse
        </p>
        <p className="text-sm text-muted-foreground">
          We'll match images to rows by <code>filename</code>, case-insensitive.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {images.length} image{images.length === 1 ? "" : "s"} ·{" "}
        {csv ? `CSV: ${csv.name}` : "no CSV yet"}
      </p>
    </div>
  );
}
