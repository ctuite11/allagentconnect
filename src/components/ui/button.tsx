import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-aac text-white hover:bg-aac-hover active:bg-aac-active shadow-sm hover:shadow focus-visible:ring-2 focus-visible:ring-zinc-400/30 no-touch-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900 active:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-zinc-400/30 no-touch-hover",
        secondary: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 no-touch-hover",
        ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 no-touch-hover",
        link: "text-aac underline-offset-4 hover:underline",
        brandOutline: "border border-aac text-aac bg-white hover:bg-aac-soft no-touch-hover",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
