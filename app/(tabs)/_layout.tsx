import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ActivityIndicator, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebSidebar } from "@/components/web-sidebar";
import { WebTopbar } from "@/components/web-topbar";

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
  const { width } = useWindowDimensions();
  // Desktop-Web: Seitenleiste statt Tab-Leiste; mobil im Browser bleiben die Tabs unten
  const isDesktopWeb = Platform.OS === "web" && width > 900;
  const bottomPadding = Platform.OS === "web" ? 16 : Math.max(insets.bottom, 8);
  const tabBarHeight = Platform.OS === "web" ? 76 : 56 + bottomPadding;
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Prüfe Login-Status
  useEffect(() => {
    checkLoginStatus();
  }, []);

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
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
      {isDesktopWeb && <WebSidebar />}
      <View style={{ flex: 1, minWidth: 0 }}>
        {isDesktopWeb && <WebTopbar />}
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: isDesktopWeb
          ? { display: "none" }
          : {
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
          // Mobil nicht in der Tab-Leiste (erreichbar über das Dashboard), auf Web sichtbar
          href: Platform.OS === "web" ? (showCustomers ? undefined : null) : null,
          title: "Kunden",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          // Mobil nicht in der Tab-Leiste (erreichbar über das Dashboard), auf Web sichtbar
          href: Platform.OS === "web" ? (showProjects ? undefined : null) : null,
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
          // Mobil ersetzt der Scanner die Buchhaltung in der Tab-Leiste;
          // auf Web bleibt sie sichtbar (erreichbar mobil über das Dashboard)
          href: Platform.OS === "web" ? (showAccounting ? undefined : null) : null,
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
      <Tabs.Screen
        name="tap-to-pay"
        options={{
          title: "Kassieren",
          href: Platform.OS === "web" ? null : showAccounting ? undefined : null,
          // Apple gibt wave.3.right(.circle) als Symbol für Tap to Pay vor
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="wave.3.right.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Einstellungen",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gear" color={color} />,
        }}
      />
      {/* Hidden Screens inside Tabs (so they get the bottom menu) */}
      <Tabs.Screen name="products" options={{ href: null, title: "Produkte" }} />
      <Tabs.Screen name="leads" options={{ href: null, title: "Akquise" }} />
      <Tabs.Screen name="quotes" options={{ href: null, title: "Angebote" }} />
      <Tabs.Screen name="contracts" options={{ href: null, title: "Verträge" }} />
      <Tabs.Screen name="knowledge-base" options={{ href: null, title: "Knowledge Base" }} />
      <Tabs.Screen name="links" options={{ href: null, title: "Links" }} />
      <Tabs.Screen name="tasks" options={{ href: null, title: "Aufgaben" }} />
      <Tabs.Screen name="dunning-settings" options={{ href: null, title: "Mahnwesen Settings" }} />
      <Tabs.Screen name="business-card" options={{ href: null, title: "Visitenkarte" }} />
      <Tabs.Screen name="notification-settings" options={{ href: null, title: "Benachrichtigungen" }} />
      <Tabs.Screen name="maintenance-windows" options={{ href: null, title: "Wartungsfenster" }} />
      <Tabs.Screen name="recurring-tickets" options={{ href: null, title: "Wartungsplan" }} />
      <Tabs.Screen name="growth-settings" options={{ href: null, title: "Kundengewinnung" }} />
      <Tabs.Screen name="website-referenzen" options={{ href: null, title: "Website-Referenzen" }} />
      <Tabs.Screen name="einsatzplan" options={{ href: null, title: "Einsatzplan" }} />
      <Tabs.Screen name="activity-log" options={{ href: null, title: "Aktivitäten & Papierkorb" }} />
      <Tabs.Screen name="users" options={{ href: null, title: "Mitarbeitende" }} />
      <Tabs.Screen name="uberwachung" options={{ href: null, title: "Überwachung" }} />
    </Tabs>
      </View>
    </View>
  );
}
