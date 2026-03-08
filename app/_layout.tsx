import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-context";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";


import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { initializePushNotifications } from "@/lib/push-notifications";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const router = useRouter();
  const segments = useSegments();
  const authHandled = useRef(false);

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();

    // Initialize Push Notifications
    initializePushNotifications().catch((error) => {
      console.error("[Push] Initialization failed:", error);
    });
  }, []);

  // Track segments in a ref to avoid re-subscribing on every navigation
  const segmentsRef = useRef(segments);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  // Global Supabase auth state listener — handles SSO callback
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only navigate on actual sign-in, NOT on token refresh or initial session
        if (event === "SIGNED_IN" && session && !authHandled.current) {
          // Only navigate if we're actually on the login/oauth screen
          const currentSegment = segmentsRef.current[0];
          if (currentSegment === "(tabs)") {
            // Already on main app — just store session, don't navigate
            await AsyncStorage.setItem("isLoggedIn", "true");
            await AsyncStorage.setItem("userEmail", session.user.email || "");
            return;
          }
          authHandled.current = true;
          await AsyncStorage.setItem("isLoggedIn", "true");
          await AsyncStorage.setItem("userEmail", session.user.email || "");
          await AsyncStorage.setItem(
            "userName",
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email || ""
          );
          console.log("[Auth] Session stored for:", session.user.email);
          router.replace("/(tabs)");
          // Reset flag after a delay so future sign-ins are handled
          setTimeout(() => { authHandled.current = false; }, 5000);
        }
        if (event === "INITIAL_SESSION" && session) {
          // Just store the session, don't navigate
          await AsyncStorage.setItem("isLoggedIn", "true");
          await AsyncStorage.setItem("userEmail", session.user.email || "");
        }
        if (event === "SIGNED_OUT") {
          authHandled.current = false;
          await AsyncStorage.removeItem("isLoggedIn");
          await AsyncStorage.removeItem("userEmail");
          await AsyncStorage.removeItem("userName");
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="oauth/callback" />
        </Stack>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
