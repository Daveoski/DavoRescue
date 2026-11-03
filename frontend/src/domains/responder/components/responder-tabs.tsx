"use client";

import { useState } from "react";

import { cn } from "@/shared/lib/cn";

import { ResponderConsole } from "./responder-console";
import { ResponderWarnings } from "./responder-warnings";

export function ResponderTabs() {
  const [view, setView] = useState<"incidents" | "warnings">("incidents");
  return (
    <div className="space-y-6">
      <div role="tablist" className="tabs tabs-border">
        {(
          [
            ["incidents", "Incidents"],
            ["warnings", "Early warnings"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={view === id} className={cn("tab", view === id && "tab-active")} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      {view === "incidents" ? <ResponderConsole /> : <ResponderWarnings />}
    </div>
  );
}
