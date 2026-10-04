import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
// @ts-ignore – JS-Konfiguration ohne Typen
import { themeColors } from "../theme.config.js";

type ThemeMode = "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "app_theme";
// Dunkles Design ist Standard
const DEFAULT_MODE: ThemeMode = "dark";

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: DEFAULT_MODE,
  resolvedTheme: DEFAULT_MODE,
  setThemeMode: () => {},
});

// CSS-Variablen pro Design – als Inline-vars() auf der Wurzel-View gesetzt,
// damit Tailwind-Klassen (bg-background, text-foreground, …) auch auf
// iOS/Android zuverlässig umschalten (der .dark-Block aus global.css
// greift nur im Web).
function buildVars(mode: ThemeMode) {
  const entries: Record<string, string> = {};
  for (const [token, value] of Object.entries(themeColors as Record<string, { light: string; dark: string }>)) {
    entries[`color-${token}`] = value[mode];
  }
  return vars(entries);
}

const THEME_VARS: Record<ThemeMode, ReturnType<typeof vars>> = {
  light: buildVars("light"),
  dark: buildVars("dark"),
};

function applyTheme(mode: ThemeMode) {
  // NativeWind: steuert dark:-Varianten
  try { nativewindColorScheme.set(mode); } catch (_) { /* noop */ }
  // Web: .dark-Klasse auf <html> für die CSS-Variablen in global.css
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.classList.toggle("light", mode === "light");
    (document.documentElement.style as any).colorScheme = mode;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_MODE);

  // Gespeicherte Wahl laden (Standard: dunkel)
  useEffect(() => {
    applyTheme(DEFAULT_MODE);
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        const mode: ThemeMode = stored === "light" ? "light" : "dark";
        setThemeModeState(mode);
        applyTheme(mode);
      })
      .catch(() => applyTheme(DEFAULT_MODE));
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    applyTheme(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  };

  const themeVariables = useMemo(() => THEME_VARS[themeMode], [themeMode]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme: themeMode,
        setThemeMode,
      }}
    >
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
