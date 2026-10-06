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
  // Welches Ziel gerade gestartet wird (null = keines)
  const [triggering, setTriggering] = useState<null | "all" | "apps" | "web" | "website">(null);

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

  const { data: appsStatus, refetch: refetchAppsStatus } = useQuery({
    queryKey: ["appReleaseStatus", "apps"],
    queryFn: () => Data.getAppReleaseStatus("apps"),
    enabled: isAdmin,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "queued" || s === "in_progress" ? 20000 : false;
    },
  });

  const { data: crmWebStatus, refetch: refetchCrmWebStatus } = useQuery({
    queryKey: ["appReleaseStatus", "web"],
    queryFn: () => Data.getAppReleaseStatus("web"),
    enabled: isAdmin,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "queued" || s === "in_progress" ? 20000 : false;
    },
  });

  const { data: websiteStatus, refetch: refetchWebsiteStatus } = useQuery({
    queryKey: ["websiteDeployStatus"],
    queryFn: Data.getWebsiteDeployStatus,
    enabled: isAdmin,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "queued" || s === "in_progress" ? 20000 : false;
    },
  });

  if (!isAdmin) return null;

  const version = Constants.expoConfig?.version || "?";
  const build = (Constants.expoConfig?.ios as any)?.buildNumber || "?";

  const trigger = (bump: "build" | "patch", target: "all" | "apps" | "web" | "website") => {
    const targetLabel = {
      all: "Apps (iOS & Android via TestFlight) UND CRM Web (portal.gross-ict.ch) — ohne die Webseite",
      apps: "nur die Apps (iOS & Android via TestFlight)",
      web: "nur CRM Web (portal.gross-ict.ch)",
      website: "nur die öffentliche Webseite (gross-ict.ch)",
    }[target];
    const bumpLabel = bump === "patch"
      ? "\n\nDie Versionsnummer wird dabei erhöht (nach einer App-Store-Freigabe nötig)."
      : "";
    const ablauf = target === "website"
      ? "\n\nAblauf: Die Webseite wird aus dem main-Branch gebaut und auf den Webspace geladen (ca. 2–3 Min.)."
      : `\n\nAblauf: Alle Branches werden gemergt und das Update automatisch veröffentlicht (Apps: ca. 20–30 Min., Web: ca. 5 Min.).`;
    showConfirm(
      "Update veröffentlichen",
      `Aktualisiert wird: ${targetLabel}.${bumpLabel}${ablauf}`,
      async () => {
        setTriggering(target);
        try {
          await Data.triggerAppRelease(bump, target);
          showToast(target === "website"
            ? "Webseiten-Deploy gestartet — in wenigen Minuten live."
            : "Update gestartet — läuft jetzt automatisch durch.");
          setTimeout(() => {
            refetchAppsStatus();
            refetchCrmWebStatus();
            refetchWebsiteStatus();
          }, 3000);
        } catch (e: any) {
          showAlert("Fehler", e.message || "Update konnte nicht gestartet werden");
        } finally {
          setTriggering(null);
        }
      },
      "Starten"
    );
  };

  // Status pro Ziel aufbereiten (eigene Zeile und eigene Sperre je Knopf)
  const makeInfo = (s: any, prefix: string, runLabel: string) => {
    if (!s || s.status === "none") return null;
    if (s.status === "queued") return { label: `${prefix}: in Warteschlange…`, color: "#f59e0b", running: true };
    if (s.status === "in_progress") return { label: `${prefix}: ${runLabel}`, color: "#f59e0b", running: true };
    if (s.conclusion === "success") return { label: `${prefix}: zuletzt erfolgreich`, color: "#22c55e", running: false };
    if (s.conclusion === "failure") return { label: `${prefix}: zuletzt fehlgeschlagen`, color: "#ef4444", running: false };
    return null;
  };
  const appsInfo = makeInfo(appsStatus, "Apps", "Release läuft…");
  const crmWebInfo = makeInfo(crmWebStatus, "CRM Web", "Release läuft…");
  const websiteInfo = makeInfo(websiteStatus, "Webseite", "Deploy läuft…");

  const appsBusy = triggering === "apps" || triggering === "all" || !!appsInfo?.running;
  const crmWebBusy = triggering === "web" || triggering === "all" || !!crmWebInfo?.running;
  const websiteBusy = triggering === "website" || !!websiteInfo?.running;
  const allBusy = !!triggering || !!appsInfo?.running || !!crmWebInfo?.running;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>App-Update</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.muted }}>Version {version} (Build {build})</Text>
      </View>

      {[
        { info: appsInfo, url: appsStatus?.html_url },
        { info: crmWebInfo, url: crmWebStatus?.html_url },
        { info: websiteInfo, url: websiteStatus?.html_url },
      ].map(({ info, url }, i) =>
        info ? (
          <TouchableOpacity
            key={i}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}
            activeOpacity={0.7}
            onPress={() => url && Linking.openURL(url)}
          >
            {info.running ? (
              <ActivityIndicator size="small" color={info.color} />
            ) : (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: info.color }} />
            )}
            <Text style={{ fontSize: 12, color: info.color, fontWeight: "600" }}>{info.label}</Text>
          </TouchableOpacity>
        ) : null
      )}

      <TouchableOpacity
        style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: allBusy ? 0.5 : 1 }}
        activeOpacity={0.8}
        disabled={allBusy}
        onPress={() => trigger("build", "all")}
      >
        {triggering === "all" ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <IconSymbol name="paperplane.fill" size={16} color={colors.background} />
        )}
        <Text style={{ color: colors.background, fontWeight: "700" }}>Alles aktualisieren</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: appsBusy ? 0.5 : 1 }}
          activeOpacity={0.8}
          disabled={appsBusy}
          onPress={() => trigger("build", "apps")}
        >
          <IconSymbol name="iphone" size={14} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Nur Apps</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: crmWebBusy ? 0.5 : 1 }}
          activeOpacity={0.8}
          disabled={crmWebBusy}
          onPress={() => trigger("build", "web")}
        >
          <IconSymbol name="desktopcomputer" size={14} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>CRM Web</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: websiteBusy ? 0.5 : 1 }}
          activeOpacity={0.8}
          disabled={websiteBusy}
          onPress={() => trigger("build", "website")}
        >
          <IconSymbol name="globe" size={14} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Webseite</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ paddingVertical: 10, alignItems: "center" }}
        activeOpacity={0.7}
        disabled={allBusy}
        onPress={() => trigger("patch", "all")}
      >
        <Text style={{ fontSize: 12, color: colors.muted, textDecorationLine: "underline" }}>
          Neue Versionsnummer (nach App-Store-Freigabe)
        </Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 16 }}>
        «Alles aktualisieren» merged alle Branches und veröffentlicht Apps (TestFlight) und CRM Web (portal.gross-ict.ch).
        Die öffentliche Webseite gross-ict.ch wird nur über den Knopf «Webseite» deployt.
      </Text>
    </View>
  );
}
