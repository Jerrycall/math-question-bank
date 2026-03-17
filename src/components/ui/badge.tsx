import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors",
        variant === "default" && "bg-primary/10 text-primary border-primary/20",
        variant === "secondary" && "bg-secondary text-secondary-foreground border-border",
        variant === "outline" && "bg-transparent border-border text-foreground",
        className
      )}
      {...props}
    />
  );
}
