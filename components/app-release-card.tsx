import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Data from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

// Admin-Karte: löst den kompletten App-Release aus (GitHub Action:
// Branches mergen -> Version erhöhen -> EAS Build -> TestFlight Submit)
export function AppReleaseCard() {
  const colors = useColors();
  const [triggering, setTriggering] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["currentSession"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const { data: profile } = useQuery({
    queryKey: ["userProfile", session?.user?.id],
    queryFn: () => Data.getUserProfile(session?.user?.id as string),
    enabled: !!session?.user?.id,
  });
  const isAdmin = !!profile?.roles?.includes("admin");

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["appReleaseStatus"],
    queryFn: Data.getAppReleaseStatus,
    enabled: isAdmin,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "queued" || s === "in_progress" ? 20000 : false;
    },
  });

  if (!isAdmin) return null;

  const version = Constants.expoConfig?.version || "?";
  const build = (Constants.expoConfig?.ios as any)?.buildNumber || "?";

  const trigger = (bump: "build" | "patch", target: "all" | "apps" | "web") => {
    const targetLabel = {
      all: "Apps (iOS & Android via TestFlight) UND Web-Portal",
      apps: "nur die Apps (iOS & Android via TestFlight)",
      web: "nur das Web-Portal (portal.gross-ict.ch)",
    }[target];
    const bumpLabel = bump === "patch"
      ? "\n\nDie Versionsnummer wird dabei erhöht (nach einer App-Store-Freigabe nötig)."
      : "";
    showConfirm(
      "Update veröffentlichen",
      `Aktualisiert wird: ${targetLabel}.${bumpLabel}\n\nAblauf: Alle Branches werden gemergt und das Update automatisch veröffentlicht (Apps: ca. 20–30 Min., Web: ca. 5 Min.).`,
      async () => {
        setTriggering(true);
        try {
          await Data.triggerAppRelease(bump, target);
          showToast("Update gestartet — läuft jetzt automatisch durch.");
          setTimeout(() => refetchStatus(), 3000);
        } catch (e: any) {
          showAlert("Fehler", e.message || "Update konnte nicht gestartet werden");
        } finally {
          setTriggering(false);
        }
      },
      "Starten"
    );
  };

  const statusInfo = (() => {
    if (!status || status.status === "none") return null;
    if (status.status === "queued") return { label: "In Warteschlange…", color: "#f59e0b", running: true };
    if (status.status === "in_progress") return { label: "Release läuft…", color: "#f59e0b", running: true };
    if (status.conclusion === "success") return { label: "Letzter Release erfolgreich", color: "#22c55e", running: false };
    if (status.conclusion === "failure") return { label: "Letzter Release fehlgeschlagen", color: "#ef4444", running: false };
    return null;
  })();

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>App-Update</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.muted }}>Version {version} (Build {build})</Text>
      </View>

      {statusInfo && (
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}
          activeOpacity={0.7}
          onPress={() => status?.html_url && Linking.openURL(status.html_url)}
        >
          {statusInfo.running ? (
            <ActivityIndicator size="small" color={statusInfo.color} />
          ) : (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusInfo.color }} />
          )}
          <Text style={{ fontSize: 12, color: statusInfo.color, fontWeight: "600" }}>{statusInfo.label}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: triggering || statusInfo?.running ? 0.5 : 1 }}
        activeOpacity={0.8}
        disabled={triggering || !!statusInfo?.running}
        onPress={() => trigger("build", "all")}
      >
        {triggering ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <IconSymbol name="paperplane.fill" size={16} color={colors.background} />
        )}
        <Text style={{ color: colors.background, fontWeight: "700" }}>Alles aktualisieren</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: triggering || statusInfo?.running ? 0.5 : 1 }}
          activeOpacity={0.8}
          disabled={triggering || !!statusInfo?.running}
          onPress={() => trigger("build", "apps")}
        >
          <IconSymbol name="iphone" size={14} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Nur Apps</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: triggering || statusInfo?.running ? 0.5 : 1 }}
          activeOpacity={0.8}
          disabled={triggering || !!statusInfo?.running}
          onPress={() => trigger("build", "web")}
        >
          <IconSymbol name="globe" size={14} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Nur Web</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ paddingVertical: 10, alignItems: "center" }}
        activeOpacity={0.7}
        disabled={triggering || !!statusInfo?.running}
        onPress={() => trigger("patch", "all")}
      >
        <Text style={{ fontSize: 12, color: colors.muted, textDecorationLine: "underline" }}>
          Neue Versionsnummer (nach App-Store-Freigabe)
        </Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 16 }}>
        Merged alle Branches und veröffentlicht automatisch: Apps zu TestFlight, Web-Portal auf portal.gross-ict.ch.
      </Text>
    </View>
  );
}
