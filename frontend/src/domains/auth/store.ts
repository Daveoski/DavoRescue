"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useHydrated } from "@/shared/lib/use-hydrated";

import type { User } from "./types";

type AuthState = {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      signOut: () => set({ token: null, user: null }),
    }),
    { name: "davorescue-session", storage: createJSONStorage(() => localStorage) },
  ),
);

/**
 * The session lives in localStorage, which the server can't see. Gate
 * auth-dependent UI on this so server and first client render agree.
 */
export const useSessionReady = useHydrated;

export const isResponder = (user: User | null) => user?.role === "responder" || user?.role === "admin";
