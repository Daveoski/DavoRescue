"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False during server rendering and hydration, true afterwards. Gate UI that
 * depends on browser-only state (localStorage, matchMedia) on this so the
 * server HTML and the first client render agree.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
