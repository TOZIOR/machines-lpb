import React from "react";
import { cn } from "@/lib/utils";

export function ScrollArea({ className, children }) {
  return <div className={cn("overflow-auto", className)}>{children}</div>;
}