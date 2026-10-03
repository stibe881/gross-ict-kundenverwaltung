import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { LogoutButton } from "@/components/logout-button";
import { AppReleaseCard } from "@/components/app-release-card";
import { useTheme } from "@/lib/theme-context";

interface SettingsRow {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  route: string;
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { themeMode, setThemeMode } = useTheme();
  const { containerStyle, contentPadding } = useResponsiveLayout();

  const { data: sessionData } = useQuery({
    queryKey: ["currentSession"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", sessionData?.user?.id],
    queryFn: () => Data.getUserProfile(sessionData?.user?.id as string),
    enabled: !!sessionData?.user?.id,
  });

  const roles: string[] = userProfile?.roles || [];
  const isAdmin = roles.includes("admin");

  const userName =
    sessionData?.user?.user_metadata?.full_name ||
    sessionData?.user?.user_metadata?.name ||
    sessionData?.user?.email?.split("@")[0] ||
    "Benutzer";
  const userEmail = sessionData?.user?.email || "";

  const roleLabels = roles
    .map((r) => Data.ROLE_DEFINITIONS.find((d) => d.key === r)?.label || r)
    .join(" · ");

  // Persönliche Einstellungen – für alle Benutzer sichtbar
  const personalRows: SettingsRow[] = [
    {
      id: "notifications",
      title: "Benachrichtigungen",
      subtitle: "Push-Benachrichtigungen ein-/ausschalten",
      icon: "bell.fill",
      color: "#F59E0B",
      route: "/notification-settings",
    },
    {
      id: "business-card",
      title: "Digitale Visitenkarte",
      subtitle: "Apple Wallet & Kontakt teilen",
      icon: "person.crop.rectangle.fill",
      color: "#0EA5E9",
      route: "/business-card",
    },
  ];

  // Administration – nur für Admins sichtbar (vorher Konfiguration auf der Startseite)
  const adminRows: SettingsRow[] = [
    {
      id: "products",
      title: "Produkte",
      subtitle: "Leistungskatalog",
      icon: "cube.box.fill",
      color: "#F97316",
      route: "/products",
    },
    {
      id: "dunning",
      title: "Rechnungen",
      subtitle: "Mahnwesen & Einstellungen",
      icon: "doc.text.fill",
      color: "#DC2626",
      route: "/dunning-settings",
    },
    {
      id: "users",
      title: "Mitarbeitende",
      subtitle: "Benutzer & Rollen",
      icon: "person.2.fill",
      color: "#6366F1",
      route: "/users",
    },
  ];

  const renderSection = (label: string, rows: SettingsRow[]) => (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          marginBottom: 10,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {rows.map((row, idx) => (
          <TouchableOpacity
            key={row.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 12,
              borderBottomWidth: idx < rows.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
            onPress={() => router.push(row.route as any)}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: row.color + "18",
              }}
            >
              <IconSymbol name={row.icon} size={18} color={row.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
                {row.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }} numberOfLines={1}>
                {row.subtitle}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ padding: contentPadding }}>
          <View style={containerStyle}>
            <Text className="text-2xl font-bold text-foreground mb-4">Einstellungen</Text>

            {/* Profil-Karte */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: "700", color: colors.background }}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                  {userName}
                </Text>
                {!!userEmail && (
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }} numberOfLines={1}>
                    {userEmail}
                  </Text>
                )}
                {!!roleLabels && (
                  <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: "600" }} numberOfLines={1}>
                    {roleLabels}
                  </Text>
                )}
              </View>
            </View>

            {/* Darstellung: Dunkles Design umschalten */}
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.muted,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 10,
                }}
              >
                Darstellung
              </Text>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
                activeOpacity={0.7}
                onPress={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#8B5CF618",
                  }}
                >
                  <IconSymbol name={themeMode === "dark" ? "moon.fill" : "sun.max.fill"} size={18} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Dunkles Design</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                    {themeMode === "dark" ? "Aktiviert" : "Deaktiviert – helles Design aktiv"}
                  </Text>
                </View>
                {/* Schalter */}
                <View
                  style={{
                    width: 46,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: themeMode === "dark" ? "#22C55E" : colors.border,
                    justifyContent: "center",
                    paddingHorizontal: 2,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#FFFFFF",
                      alignSelf: themeMode === "dark" ? "flex-end" : "flex-start",
                    }}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {renderSection("Persönlich", personalRows)}

            {/* Nur Admins sehen und verwalten die Administration */}
            {isAdmin && renderSection("Administration", adminRows)}

            {/* App-Update direkt in den Einstellungen (nur Admins) */}
            {isAdmin && (
              <View style={{ marginBottom: 18 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.muted,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    marginBottom: 10,
                  }}
                >
                  App-Update
                </Text>
                <AppReleaseCard />
              </View>
            )}

            {/* Abmelden */}
            <View style={{ alignItems: "center", marginTop: 6 }}>
              <LogoutButton />
            </View>

            <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 18 }}>
              Gross ICT Kundenverwaltung · Version {Constants.expoConfig?.version || "–"}
            </Text>

            <View style={{ height: 24 }} />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
