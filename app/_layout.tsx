import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider, useTheme } from "@/lib/theme-context";

// Statusbar folgt dem gewählten Design (dunkles Design → helle Symbole)
function ThemedStatusBar() {
  const { resolvedTheme } = useTheme();
  return <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />;
}
import { ToastProvider } from "@/components/toast-provider";
import { RouteGuard } from "@/components/route-guard";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";


import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { initializePushNotifications } from "@/lib/push-notifications";
import * as Data from "@/lib/data";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import * as Notifications from 'expo-notifications';
import * as QuickActions from 'expo-quick-actions';

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };



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

    if (Platform.OS === 'web') {
      document.title = "CRM - Gross ICT";
    }

    // Initialize Push Notifications
    initializePushNotifications().catch((error) => {
      console.error("[Push] Initialization failed:", error);
    });
  }, []);

  // Team-Präsenz: beim Start und bei App-Fokus "zuletzt online" aktualisieren
  useEffect(() => {
    Data.pingPresence();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") Data.pingPresence();
    });
    return () => sub.remove();
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
      const notificationData = response.notification.request.content.data || {};
      const url = notificationData.url;

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
        // Map notification URLs to actual app routes
        const routeMap: Record<string, string> = {
          '/invoices': '/(tabs)/accounting',
          '/contracts': '/contracts',
          '/quotes': '/quotes',
        };
        const resolvedUrl = routeMap[url as string] || url;
        // Small delay to ensure app is fully loaded before navigating
        setTimeout(() => router.push(resolvedUrl as any), 300);
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
    const syncUserProfileToDB = async (session: any) => {
      const authProvider = session.user.app_metadata?.provider || "email";
      const userName = session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.email?.split("@")[0] || "";
      try {
        // Try to find existing user by email to handle SSO Identity gaps (409 Conflict avoid)
        const { data: existingUserByEmail } = await supabase
          .from("users")
          .select("*")
          .eq("email", session.user.email)
          .maybeSingle();

        if (existingUserByEmail) {
          if (existingUserByEmail.id !== session.user.id) {
            // Local user exists with same email but different ID (SSO login collision).
            // Try to repoint the public.users record to the new SSO ID.
            const { error: updateIdError } = await supabase
              .from("users")
              .update({ id: session.user.id, provider: authProvider })
              .eq("email", session.user.email);
            
            if (updateIdError) {
              // Fails if Foreign Keys exist. Rename old email and insert new row, migrating roles!
              await supabase.from("users").update({ 
                email: "merged_sso_" + session.user.id.substring(0, 5) + "_" + session.user.email 
              }).eq("id", existingUserByEmail.id);
              
              await supabase.from("users").insert({
                id: session.user.id,
                email: session.user.email,
                name: userName || existingUserByEmail.name,
                provider: authProvider,
                is_active: true,
                roles: existingUserByEmail.roles || [], // Copy permissions
              } as any);
            }
          } else {
            // Standard update for existing matching user
            await supabase.from("users").update({
              name: userName,
              provider: authProvider,
              is_active: true,
            }).eq("id", session.user.id);
          }
        } else {
          // Completely new user!
          await supabase.from("users").insert({
            id: session.user.id,
            email: session.user.email,
            name: userName,
            provider: authProvider,
            is_active: true,
            role: "admin",
            roles: [],
          });
        }
        console.log("[Auth] User profile synced, provider:", authProvider);
      } catch (e) {
        console.warn("[Auth] Failed to sync user profile:", e);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only navigate on actual sign-in, NOT on token refresh or initial session
        if (event === "SIGNED_IN" && session && !authHandled.current) {
          const isCustomerPortalUser = !!session.user.user_metadata?.customer_id;

          // Only navigate if we're actually on the login/oauth screen
          const currentSegment = segmentsRef.current[0];
          const isAuthScreen = currentSegment === "login" || currentSegment === "oauth";
          
          if (!isAuthScreen && !isCustomerPortalUser) {
            // Already on main app, or hydrating, or somewhere else — just store session, don't navigate
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

            await syncUserProfileToDB(session);

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
            await syncUserProfileToDB(session);
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
          
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.location.reload();
          } else {
            router.replace("/login");
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Setup Home Screen Quick Actions based on Auth (Admins only)
  useEffect(() => {
    const setupQuickActions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          QuickActions.setItems([]);
          return;
        }

        const { data: userProfile } = await supabase
          .from("users")
          .select("roles")
          .eq("id", session.user.id)
          .single();

        const roles = userProfile?.roles || [];
        if (roles.includes("admin")) {
          QuickActions.setItems([
            {
              title: "Beleg scannen",
              subtitle: "Direkt zur Kamera öffnen",
              icon: "compose", // iOS system icon similar to camera/scan
              id: "scan_receipt",
              params: { href: "/(tabs)/scanner" }
            }
          ]);
        } else {
          QuickActions.setItems([]);
        }
      } catch (e) {
        console.warn("Failed to setup quick actions", e);
      }
    };

    setupQuickActions();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setupQuickActions();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle Quick Action Launches
  useEffect(() => {
    const handleAction = (action: QuickActions.Action) => {
      if (action.id === "scan_receipt") {
        router.push("/(tabs)/scanner");
      }
    };

    const sub = QuickActions.addListener(handleAction);
    
    // Check if app was launched directly via Quick Action
    const initialAction = QuickActions.initial;
    if (initialAction && initialAction.id === "scan_receipt") {
      setTimeout(() => router.push("/(tabs)/scanner"), 600); // Wait for navigation tree
    }

    return () => sub.remove();
  }, [router]);

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
        <RouteGuard>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="oauth/callback" />
            </Stack>
            <ThemedStatusBar />
          </ToastProvider>
        </RouteGuard>
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
