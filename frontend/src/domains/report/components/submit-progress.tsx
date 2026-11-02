"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/cn";

/** The report is one request; this narrates what the server is doing so the wait feels purposeful. */
export function SubmitProgress({ hasPhotos }: { hasPhotos: boolean }) {
  const steps = [
    "Pinning the exact road",
    hasPhotos ? "Checking your photos and description" : "Checking your description",
    "Comparing with nearby reports",
    "Alerting the responders for this area",
  ];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => Math.min(a + 1, steps.length - 1)), 2200);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="fixed inset-0 z-[900] grid place-items-center bg-base-100/90 p-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Sending report</p>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={step} className={cn("flex items-center gap-3 text-lg", i > active && "text-base-content/35")}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border",
                  i < active ? "border-success bg-success text-success-content" : "border-base-300",
                )}
              >
                {i < active ? <Check className="size-4" /> : i === active ? <span className="loading loading-spinner loading-xs" /> : null}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-base-content/60">Keep this screen open. If you’re in danger, call 112 now.</p>
      </div>
    </div>
  );
}
