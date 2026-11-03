/** Carry the page someone was heading to across sign-in and sign-up. */
export const withNext = (path: string, next?: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

/** Only follow same-site paths, never an absolute or protocol-relative URL from the query string. */
export const safeNext = (next: string | null) =>
  next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : undefined;
