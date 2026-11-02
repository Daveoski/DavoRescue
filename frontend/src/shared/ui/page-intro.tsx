import type { ReactNode } from "react";

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-extrabold leading-[1.02] sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 text-lg text-base-content/75">{children}</div>}
    </header>
  );
}
