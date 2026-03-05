import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

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
        const { supabase } = await import("@/lib/supabase");
        // Give Supabase time to process any URL tokens
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
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
          title: "Kunden",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounting"
        options={{
          title: "Buchhaltung",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: "Akquise",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="briefcase.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Tickets",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ticket.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: "Angebote",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Produkte",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cube.box.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
