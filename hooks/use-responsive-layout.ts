import { Platform, useWindowDimensions } from "react-native";

/**
 * Shared responsive layout hook used by all modules.
 * Provides breakpoint flags and a container style for web centering.
 */
export function useResponsiveLayout() {
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === "web";
    const isWide = isWeb && width > 900;
    const isMedium = isWeb && width > 600 && width <= 900;

    const containerStyle = isWide
        ? ({ flex: 1, maxWidth: 1200, alignSelf: "center" as const, width: "100%" as const })
        : ({ flex: 1 } as const);

    const contentPadding = isWide ? 32 : 16;

    return { isWeb, isWide, isMedium, containerStyle, contentPadding, width };
}
