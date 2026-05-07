import React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "secondary", ...props }) {
  const variants = {
    default: "bg-slate-900 text-white",
    secondary: "bg-slate-100 text-slate-900",
    outline: "border border-slate-200 bg-white text-slate-900",
    destructive: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant] || variants.secondary,
        className
      )}
      {...props}
    />
  );
}