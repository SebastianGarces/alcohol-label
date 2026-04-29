"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ImagePreviewProps = {
  src: string;
  alt: string;
  /** Sizing for the trigger button (the inline thumbnail) */
  className?: string;
  /** Sizing for the <img> inside the trigger */
  imgClassName?: string;
  /** Optional caption rendered under the image inside the modal */
  caption?: string;
};

export function ImagePreview({
  src,
  alt,
  className,
  imgClassName,
  caption,
}: ImagePreviewProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative block overflow-hidden rounded-md border border-ledger bg-bone transition hover:border-rust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2",
          className,
        )}
        aria-label={`View ${alt} at full size`}
      >
        {/* biome-ignore lint/performance/noImgElement: blob: URLs cannot be served through next/image */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]",
            imgClassName,
          )}
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-hidden bg-paper p-0 sm:max-w-[min(90vw,1200px)]">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* biome-ignore lint/performance/noImgElement: blob: URLs cannot be served through next/image */}
          <img
            src={src}
            alt={alt}
            className="mx-auto block max-h-[80vh] w-auto object-contain"
          />
          {caption ? (
            <p className="border-t border-ledger px-6 py-3 text-base text-graphite">{caption}</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
