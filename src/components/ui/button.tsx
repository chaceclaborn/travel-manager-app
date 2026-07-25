import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base geometry matches the design system's button: 9px radius, 13px/500
  // label, no transform on hover. `transition-colors` (not `transition-all`)
  // keeps the hover from animating size or shadow.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[15px] shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40 aria-invalid:border-tm-danger-border",
  {
    variants: {
      variant: {
        // Primary actions are near-black, not amber. Amber is reserved for
        // "next / active / accent" — spending it on every button left the
        // accent with no meaning.
        default:
          "bg-tm-action text-white shadow-tm-action hover:bg-tm-action-hover",
        destructive:
          "bg-white border border-tm-danger-border text-tm-danger hover:bg-tm-danger-bg",
        outline:
          "border border-tm-control bg-white text-tm-body shadow-tm-control hover:border-tm-control-hover hover:bg-tm-wash",
        secondary:
          "bg-tm-fill text-tm-body hover:bg-tm-strong",
        ghost:
          "text-tm-muted hover:bg-tm-fill hover:text-tm-body",
        link: "text-tm-accent-text underline-offset-4 hover:text-tm-accent-text-hover hover:underline",
      },
      size: {
        default: "h-9 px-4 has-[>svg]:px-3.5",
        xs: "h-7 gap-1 rounded-[7px] px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[8px] px-3 text-[12px] has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-7 rounded-[7px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[8px]",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
