import { cn } from "@/lib/utils";

/**
 * MicUp wordmark — minimal microphone symbol + name.
 */
export function MicUpLogo({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="relative flex items-center justify-center rounded-none bg-primary text-primary-foreground"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <path d="M12 18v4" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        Mic<span className="text-primary">Up</span>
      </span>
    </span>
  );
}
