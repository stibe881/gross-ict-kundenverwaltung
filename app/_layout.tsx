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
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import * as Notifications from 'expo-notifications';

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

  // Store received push notifications in DB for dashboard activities
  const receivedListener = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    // Listen for incoming notifications (while app is open)
    receivedListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
      const { title, body } = notification.request.content;
      if (!title) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        await supabase.from("notifications").insert({
          user_id: session.user.id,
          title: title,
          message: body || "",
          type: "push",
          is_read: false,
        });
      } catch (e) {
        console.warn("[Push] Failed to save notification to DB:", e);
      }
    });

    return () => {
      if (receivedListener.current) {
        receivedListener.current.remove();
      }
    };
  }, []);

  // Deep linking for notification taps
  const responseListener = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { title, body } = response.notification.request.content;
      const { url } = response.notification.request.content.data;

      // Also save tapped notifications to DB (in case they arrived while app was closed)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && title) {
          // Check if already saved (avoid duplicates)
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", session.user.id)
            .eq("title", title)
            .eq("message", body || "")
            .gte("created_at", new Date(Date.now() - 60000).toISOString())
            .limit(1);
          if (!existing || existing.length === 0) {
            await supabase.from("notifications").insert({
              user_id: session.user.id,
              title: title,
              message: body || "",
              type: "push",
              is_read: true, // Mark as read since user tapped it
            });
          } else {
            // Mark existing as read
            await supabase.from("notifications").update({ is_read: true }).eq("id", existing[0].id);
          }
        }
      } catch (e) {
        console.warn("[Push] Failed to save tapped notification:", e);
      }

      if (url) {
        router.push(url as any);
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Global Supabase auth state listener — handles SSO callback
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only navigate on actual sign-in, NOT on token refresh or initial session
        if (event === "SIGNED_IN" && session && !authHandled.current) {
          const isCustomerPortalUser = !!session.user.user_metadata?.customer_id;

          // Only navigate if we're actually on the login/oauth screen
          const currentSegment = segmentsRef.current[0];
          if (currentSegment === "(tabs)" && !isCustomerPortalUser) {
            // Already on main app (and allowed) — just store session, don't navigate
            await AsyncStorage.setItem("isLoggedIn", "true");
            await AsyncStorage.setItem("userEmail", session.user.email || "");
            // Still register push token even when not navigating
            registerForPushNotificationsAsync("admin", session.user.id, session.user.email).catch(console.error);
            return;
          }

          authHandled.current = true;

          if (isCustomerPortalUser) {
            console.log("[Auth] Customer portal login detected");
            await AsyncStorage.setItem("isCustomerLoggedIn", "true");
            await AsyncStorage.setItem("customerEmail", session.user.email || "");
            await AsyncStorage.setItem('customer_portal_user', JSON.stringify({
              id: session.user.id,
              email: session.user.email,
            }));

            registerForPushNotificationsAsync("customer", session.user.id, session.user.email).catch(console.error);
            router.replace("/portal-tickets-customer");
          } else {
            console.log("[Auth] Session stored for:", session.user.email);
            await AsyncStorage.setItem("isLoggedIn", "true");
            await AsyncStorage.setItem("userEmail", session.user.email || "");
            await AsyncStorage.setItem(
              "userName",
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email || ""
            );

            registerForPushNotificationsAsync("admin", session.user.id, session.user.email).catch(console.error);
            router.replace("/(tabs)");
          }

          // Reset flag after a delay so future sign-ins are handled
          setTimeout(() => { authHandled.current = false; }, 5000);
        }
        if (event === "INITIAL_SESSION" && session) {
          const isCustomerPortalUser = !!session.user.user_metadata?.customer_id;
          if (isCustomerPortalUser) {
            await AsyncStorage.setItem("isCustomerLoggedIn", "true");
            await AsyncStorage.setItem("customerEmail", session.user.email || "");
            registerForPushNotificationsAsync("customer", session.user.id, session.user.email).catch(console.error);
          } else {
            await AsyncStorage.setItem("isLoggedIn", "true");
            await AsyncStorage.setItem("userEmail", session.user.email || "");
            registerForPushNotificationsAsync("admin", session.user.id, session.user.email).catch(console.error);
          }
        }
        if (event === "SIGNED_OUT") {
          authHandled.current = false;
          await AsyncStorage.removeItem("isLoggedIn");
          await AsyncStorage.removeItem("userEmail");
          await AsyncStorage.removeItem("userName");
          await AsyncStorage.removeItem("isCustomerLoggedIn");
          await AsyncStorage.removeItem("customerEmail");
          await AsyncStorage.removeItem("customer_portal_user");
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
