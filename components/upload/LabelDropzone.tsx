"use client";

import { ImagePlus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "@/components/ui/ImagePreview";
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
        <ImagePreview
          src={previewUrl}
          alt={`Selected label · ${file.name}`}
          caption={`${file.name} · ${formatFileSize(file.size)}`}
          className="w-full"
          imgClassName="max-h-96"
        />
        <p className="text-base text-graphite">
          {file.name} · {formatFileSize(file.size)}{" "}
          <span className="text-pencil">· click image to enlarge</span>
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => onFile(null)}
          className="w-fit gap-2"
        >
          <RefreshCw className="size-4" />
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
            "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border p-8 text-center transition focus-within:ring-2 focus-within:ring-rust focus-within:ring-offset-2",
            isDragActive
              ? "border-rust bg-rust-tint"
              : rejection
                ? "border-fail-rule bg-fail-tint"
                : "border-ledger bg-bone hover:bg-bone/80",
          ),
        })}
      >
        <input {...getInputProps()} aria-label="Upload label image" />
        <ImagePlus aria-hidden className="size-10 text-pencil" />
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium text-ink">Drop a label image, or click to browse</p>
          <p className="text-base text-graphite">JPG or PNG up to 5 MB</p>
        </div>
      </div>
      {rejection ? (
        <p role="alert" className="text-base text-fail-ink">
          {rejection}
        </p>
      ) : null}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
