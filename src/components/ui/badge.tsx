import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border px-[9px] py-[3px] text-[11px] font-medium [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:ring-2 focus-visible:ring-tm-accent/40",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-tm-fill text-tm-label",
        secondary:
          "border-transparent bg-tm-wash text-tm-muted shadow-[inset_0_0_0_1px_var(--color-tm-hairline)]",
        destructive:
          "border-transparent bg-tm-cancel-bg text-tm-cancel-text shadow-[inset_0_0_0_1px_var(--color-tm-cancel-ring)]",
        outline:
          "border-tm-control text-tm-body [a&]:hover:bg-tm-wash",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
