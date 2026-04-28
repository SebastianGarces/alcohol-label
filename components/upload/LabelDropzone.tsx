"use client";

import { ImagePlus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

function rejectionMessage(code: string): string {
  if (code === "file-too-large") return "That image is over 5 MB. Please use a smaller photo.";
  if (code === "file-invalid-type") return "Please upload a JPG or PNG image.";
  if (code === "too-many-files") return "Only one image at a time.";
  return "We couldn't accept that file. Please try a different image.";
}

export function LabelDropzone({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    maxFiles: 1,
    maxSize: MAX_BYTES,
    onDrop: (accepted, rejections) => {
      if (rejections.length) {
        const code = rejections[0]?.errors?.[0]?.code ?? "unknown";
        setRejection(rejectionMessage(code));
        return;
      }
      const next = accepted[0];
      if (next) {
        setRejection(null);
        onFile(next);
      }
    },
  });

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file && previewUrl) {
    return (
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border bg-muted">
          {/* biome-ignore lint/performance/noImgElement: blob: URLs cannot be served through next/image */}
          <img
            src={previewUrl}
            alt="Selected label"
            className="mx-auto max-h-96 w-auto object-contain"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFile(null)}
          className="w-fit gap-2"
        >
          <RotateCcw className="size-4" />
          Choose a different image
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps({
          className: cn(
            "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
            isDragActive
              ? "border-primary bg-primary/5"
              : rejection
                ? "border-red-300 bg-red-50"
                : "border-slate-300 bg-slate-50 hover:bg-slate-100",
          ),
        })}
      >
        <input {...getInputProps()} aria-label="Upload label image" />
        <ImagePlus aria-hidden className="size-10 text-slate-500" />
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium">Drop a label image, or click to browse</p>
          <p className="text-sm text-muted-foreground">JPG or PNG up to 5 MB</p>
        </div>
      </div>
      {rejection ? (
        <p role="alert" className="text-sm text-red-800">
          {rejection}
        </p>
      ) : null}
    </div>
  );
}
