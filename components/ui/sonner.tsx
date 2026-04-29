"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-pass-ink" />
        ),
        info: (
          <InfoIcon className="size-4 text-graphite" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-review-ink" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-fail-ink" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin text-graphite" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "!bg-paper !text-ink !border !border-ledger !shadow-card !font-sans",
          title: "!text-ink !text-base !font-medium",
          description: "!text-graphite",
          actionButton: "!bg-rust !text-paper",
          cancelButton: "!bg-bone !text-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
