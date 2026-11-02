"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `fn` now and then every `ms` while mounted. The latest `fn` is always
 * used, so callers don't need to memoise it; change `key` to restart the cycle.
 */
export function usePoll(fn: () => unknown, ms: number, key: unknown = null) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    const tick = () => void latest.current();
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, ms);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ms, key]);
}
