import { Colors, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";

/**
 * Returns the current theme's color palette.
 * Usage: const colors = useColors(); then colors.text, colors.background, etc.
 */
export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  const { resolvedTheme } = useTheme();
  const scheme = (colorSchemeOverride ?? resolvedTheme) as ColorScheme;
  return Colors[scheme];
}
