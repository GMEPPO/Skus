import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  children,
}: {
  className?: string;
  variant?: "default" | "outline" | "success";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
        variant === "default" && "bg-amber-400/15 text-amber-300",
        variant === "outline" && "border border-slate-700 bg-slate-800 text-slate-300",
        variant === "success" && "bg-emerald-500/15 text-emerald-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
