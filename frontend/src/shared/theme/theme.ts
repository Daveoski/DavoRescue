export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "davorescue-theme";
const DAISY_THEME = { light: "davo", dark: "davo-night" } as const;
const BROWSER_BAR = { light: "#fbfaf7", dark: "#101216" } as const;

/**
 * Runs synchronously in <head>, before the first paint, so a saved choice never
 * flashes the other theme. "system" leaves data-theme unset and daisyUI follows
 * the OS through prefers-color-scheme.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p==="light"||p==="dark")document.documentElement.setAttribute("data-theme",p==="dark"?"${DAISY_THEME.dark}":"${DAISY_THEME.light}")}catch(e){}})()`;

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", DAISY_THEME[preference]);

  // Keep the mobile browser bar in step with the page.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((meta) => {
    const media = meta.getAttribute("media") ?? "";
    meta.content =
      preference === "system" ? BROWSER_BAR[media.includes("dark") ? "dark" : "light"] : BROWSER_BAR[preference];
  });
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* private mode: the choice still applies for this visit */
  }
}
