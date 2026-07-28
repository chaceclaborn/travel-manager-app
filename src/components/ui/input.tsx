import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 16px on mobile (below `md`) is deliberate: iOS Safari zooms the
        // viewport on focus for anything smaller.
        "h-[38px] w-full min-w-0 rounded-[9px] border border-tm-control bg-white px-3 text-base text-[#1E293B] shadow-tm-control outline-none transition-[color,box-shadow] placeholder:text-tm-subtle file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-tm-body disabled:cursor-not-allowed disabled:bg-tm-fill disabled:opacity-60 md:text-[13px]",
        "focus-visible:border-tm-accent focus-visible:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]",
        "aria-invalid:border-tm-danger-border aria-invalid:shadow-[0_0_0_3px_rgba(248,113,113,0.12)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
