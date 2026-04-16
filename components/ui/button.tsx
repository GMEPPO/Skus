import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
  asChild?: boolean;
};

export function Button({
  variant = "default",
  asChild = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" && "bg-amber-400 text-slate-950 hover:bg-amber-300",
        variant === "outline" && "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
