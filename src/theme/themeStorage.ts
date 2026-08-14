import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isTauriRuntime } from "../utils/runtime";
import { DEFAULT_THEME, getThemePreset, type ThemeSlug } from "./themePresets";

const LOCAL_STORAGE_KEY = "entropy.appearance.theme";
const SETTINGS_DIR = "settings";
const SETTINGS_FILE = "settings/appearance.json";

interface AppearanceSettings {
  theme: ThemeSlug;
}

function readBrowserTheme(): ThemeSlug {
  try {
    return getThemePreset(window.localStorage.getItem(LOCAL_STORAGE_KEY)).slug;
  } catch {
    return DEFAULT_THEME;
  }
}

function saveBrowserTheme(theme: ThemeSlug) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, theme);
  } catch {
    // A blocked localStorage should not prevent theme switching in-session.
  }
}

export async function loadSavedTheme(): Promise<ThemeSlug> {
  if (!isTauriRuntime()) return readBrowserTheme();

  try {
    const content = await readTextFile(SETTINGS_FILE, { baseDir: BaseDirectory.AppConfig });
    const parsed = JSON.parse(content) as Partial<AppearanceSettings>;
    return getThemePreset(parsed.theme).slug;
  } catch {
    return readBrowserTheme();
  }
}

export async function saveTheme(theme: ThemeSlug): Promise<void> {
  saveBrowserTheme(theme);

  if (!isTauriRuntime()) return;

  try {
    const hasSettingsDir = await exists(SETTINGS_DIR, { baseDir: BaseDirectory.AppConfig });
    if (!hasSettingsDir) {
      await mkdir(SETTINGS_DIR, { baseDir: BaseDirectory.AppConfig, recursive: true });
    }
    await writeTextFile(SETTINGS_FILE, JSON.stringify({ theme }, null, 2), { baseDir: BaseDirectory.AppConfig });
  } catch {
    // Browser fallback was already saved; keep the UI responsive if native write fails.
  }
}
