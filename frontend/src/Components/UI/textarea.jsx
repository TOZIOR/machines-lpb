import React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300",
        className
      )}
      {...props}
    />
  );
}