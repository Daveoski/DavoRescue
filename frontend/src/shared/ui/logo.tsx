import { cn } from "@/shared/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-neutral" />
      <path d="M16 5.5c-4.6 0-8.3 3.6-8.3 8.1 0 6 8.3 12.9 8.3 12.9s8.3-6.9 8.3-12.9c0-4.5-3.7-8.1-8.3-8.1z" fill="#d63a1f" />
      <path d="M12.6 13.7h6.8M16 10.3v6.8" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M6 28.5h20" className="stroke-accent" strokeWidth="1.6" strokeDasharray="3 2.4" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[1.35rem] font-extrabold leading-none tracking-tight" style={{ fontStretch: "78%" }}>
        Davo<span className="text-primary">Rescue</span>
      </span>
    </span>
  );
}
