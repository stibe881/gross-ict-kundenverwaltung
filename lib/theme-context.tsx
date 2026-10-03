import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme as nativewindColorScheme } from "nativewind";

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

function applyTheme(mode: ThemeMode) {
  // NativeWind: steuert dark:-Varianten und CSS-Variablen
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

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme: themeMode,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
