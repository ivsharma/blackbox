import { browser } from "wxt/browser";

export type Theme = "light" | "dark";

const THEME_KEY = "blackbox.theme";

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export async function getTheme(): Promise<Theme> {
  try {
    const stored = await browser.storage.local.get(THEME_KEY);
    const value = stored[THEME_KEY];
    if (value === "light" || value === "dark") return value;
  } catch (e) {
    console.error("Error loading theme:", e);
  }
  return systemTheme();
}

export async function setTheme(theme: Theme): Promise<void> {
  try {
    await browser.storage.local.set({ [THEME_KEY]: theme });
  } catch (e) {
    console.error("Error saving theme:", e);
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export async function initTheme(): Promise<Theme> {
  const theme = await getTheme();
  applyTheme(theme);
  return theme;
}