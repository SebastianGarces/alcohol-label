import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-md border border-rule bg-paper px-3.5 text-base text-ink transition-colors outline-none file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-pencil focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-rust/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bone disabled:opacity-60 aria-invalid:border-fail-rule aria-invalid:ring-3 aria-invalid:ring-fail-tint",
        className
      )}
      {...props}
    />
  )
}

export { Input }
