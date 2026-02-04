import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, ActivityIndicator } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  // TODO: Auth-Check temporär deaktiviert bis OAuth konfiguriert ist
  // Nach OAuth-Setup wieder aktivieren:
  // const { user, isAuthenticated, loading } = useAuth();
  // const router = useRouter();
  // const [hasRedirected, setHasRedirected] = useState(false);
  // const [forceReady, setForceReady] = useState(false);
  //
  // useEffect(() => {
  //   const timeout = setTimeout(() => setForceReady(true), 3000);
  //   return () => clearTimeout(timeout);
  // }, []);
  //
  // useEffect(() => {
  //   if ((forceReady || !loading) && !isAuthenticated && !hasRedirected) {
  //     setHasRedirected(true);
  //     router.replace("/portal-login");
  //   }
  // }, [loading, isAuthenticated, hasRedirected, forceReady, router]);
  //
  // if (loading && !forceReady) {
  //   return (
  //     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
  //       <ActivityIndicator size="large" color={colors.primary} />
  //     </View>
  //   );
  // }
  //
  // if (!isAuthenticated) {
  //   return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  // }

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
        name="products"
        options={{
          title: "Produkte",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cube.box.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
