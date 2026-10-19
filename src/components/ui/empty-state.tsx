import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-none border-2 border-foreground bg-card px-6 py-14 text-center shadow-[6px_6px_0_hsl(var(--primary))]",
        className
      )}
    >
      {/* Dot-grid art band across the top */}
      <div
        aria-hidden
        className="tf-art pointer-events-none absolute inset-x-0 top-0 h-20 border-b-2 border-foreground"
      />

      <div className="relative flex flex-col items-center">
        {icon ? (
          <div className="mb-3 flex h-11 w-11 items-center justify-center border-2 border-foreground bg-background text-primary">
            {icon}
          </div>
        ) : null}
        <p className="font-display text-base font-semibold">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
