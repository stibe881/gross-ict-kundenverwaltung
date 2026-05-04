import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Prüfe Login-Status
  useEffect(() => {
    checkLoginStatus();
  }, []);

  // Fällige Erinnerungen im Hintergrund verarbeiten (Push + E-Mail)
  useEffect(() => {
    if (!isLoggedIn) return;
    const processReminders = async () => {
      try {
        await supabase.functions.invoke('process-reminders');
      } catch (_) { /* Silently ignore */ }
    };
    processReminders(); // Sofort beim Start
    const interval = setInterval(processReminders, 60 * 1000); // Alle 60 Sekunden
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Fetch session and user roles dynamically for Tab visibility
  const { data: sessionData } = useQuery({
    queryKey: ["currentSession"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    }
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", sessionData?.user?.id],
    queryFn: () => Data.getUserProfile(sessionData?.user?.id as string),
    enabled: !!sessionData?.user?.id,
  });

  const roles = userProfile?.roles || [];
  const isAdmin = roles.includes("admin");
  const showCustomers = isAdmin || roles.includes("administration");
  const showAccounting = isAdmin || roles.includes("finanzen");
  const showTickets = isAdmin || roles.includes("technik");
  const showProductsScanner = isAdmin || roles.includes("finanzen");
  const showProjects = isAdmin || roles.includes("administration") || roles.includes("technik") || roles.includes("finanzen");

  const checkLoginStatus = async () => {
    try {
      // Fast path: check AsyncStorage first
      const loggedIn = await AsyncStorage.getItem("isLoggedIn");
      if (loggedIn === "true") {
        setIsLoggedIn(true);
        return;
      }

      // After SSO redirect, Supabase auto-detects tokens from the URL hash
      // and strips them before our code runs. We must always check the
      // Supabase session before redirecting to /login.
      if (Platform.OS === "web") {
        // Give Supabase time to process any URL tokens
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (session.user.user_metadata?.customer_id) {
            router.replace("/portal-tickets-customer");
            return;
          }

          await AsyncStorage.setItem("isLoggedIn", "true");
          await AsyncStorage.setItem("userEmail", session.user.email || "");
          await AsyncStorage.setItem("userName",
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email || "");
          setIsLoggedIn(true);
          return;
        }
      }

      // No session found — redirect to login
      setIsLoggedIn(false);
      router.replace("/login");
    } catch (error) {
      setIsLoggedIn(false);
      router.replace("/login");
    }
  };

  // Zeige Loading während Login-Check
  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Zeige nichts wenn nicht angemeldet (wird weitergeleitet)
  if (!isLoggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} />
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          href: showCustomers ? undefined : null,
          title: "Kunden",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          href: showProjects ? undefined : null,
          title: "Projekte",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="folder.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          href: showTickets ? undefined : null,
          title: "Tickets",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ticket.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounting"
        options={{
          href: showAccounting ? undefined : null,
          title: "Buchhaltung",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          href: Platform.OS === "web" ? null : showProductsScanner ? undefined : null,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="camera.fill" color={color} />,
        }}
      />
      {/* Hidden Screens inside Tabs (so they get the bottom menu) */}
      <Tabs.Screen name="products" options={{ href: null, title: "Produkte" }} />
      <Tabs.Screen name="leads" options={{ href: null, title: "Akquise" }} />
      <Tabs.Screen name="quotes" options={{ href: null, title: "Angebote" }} />
      <Tabs.Screen name="contracts" options={{ href: null, title: "Verträge" }} />
      <Tabs.Screen name="knowledge-base" options={{ href: null, title: "Knowledge Base" }} />
      <Tabs.Screen name="links" options={{ href: null, title: "Links" }} />
      <Tabs.Screen name="marketing" options={{ href: null, title: "Marketing" }} />
      <Tabs.Screen name="tasks" options={{ href: null, title: "Aufgaben" }} />
      <Tabs.Screen name="dunning-settings" options={{ href: null, title: "Mahnwesen Settings" }} />
      <Tabs.Screen name="business-card" options={{ href: null, title: "Visitenkarte" }} />
      <Tabs.Screen name="users" options={{ href: null, title: "Mitarbeitende" }} />
      <Tabs.Screen name="uberwachung" options={{ href: null, title: "Überwachung" }} />
    </Tabs>
  );
}
