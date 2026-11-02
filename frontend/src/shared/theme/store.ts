"use client";

import { create } from "zustand";

import { applyTheme, readThemePreference, saveThemePreference, type ThemePreference } from "./theme";

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export const useTheme = create<ThemeState>()((set) => ({
  preference: typeof window === "undefined" ? "system" : readThemePreference(),
  setPreference: (preference) => {
    saveThemePreference(preference);
    applyTheme(preference);
    set({ preference });
  },
}));
