import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { supabase } from "@/lib/supabase";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

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

  useEffect(() => {
    const seg0 = segments[0] as string | undefined;
    const seg1 = (segments as string[])[1] as string | undefined;

    // Wenn der Nutzer auf dem Login oder OAuth Callback ist, ignorieren wir den Guards
    if (seg0 === "login" || seg0 === "oauth") return;

    // Wenn der Benutzer oder die Session Daten noch nicht geladen sind, warten
    if (!userProfile) return;

    const roles = userProfile.roles || [];
    const allowedTiles = Data.getAllowedTileIds(roles);

    // null steht in getAllowedTileIds für den vollen Admin-Zustand
    if (allowedTiles === null) return;

    // Ermittle das geöffnete Modul (entweder 1. Ebene oder in Tabs)
    const currentModule = (seg0 === "(tabs)" ? seg1 : seg0) || "";

    // Root-Dashboard ("index") darf prinzipiell immer geladen werden
    if (!currentModule || currentModule === "index") return;

    // Mapping von Expo Router Pfaden auf Tile IDs für Berechtigungs-Checks
    let tileIdToCheck = currentModule;
    if (currentModule === "dunning-settings") tileIdToCheck = "dunning";

    // Diese Tiles (Module) werden durch RBAC berechtigungen geschützt
    const PROTECTED_TILES = [
      "customers", "leads", "accounting", "tickets", "products", "scanner",
      "quotes", "contracts", "knowledge-base", "projects", "tasks", "links", "dunning", "users"
    ];

    if (PROTECTED_TILES.includes(tileIdToCheck)) {
      if (!allowedTiles.includes(tileIdToCheck)) {
        console.warn(`[RouteGuard] Blockierter Zugriff auf /${currentModule}. Umleitung auf Dashboard.`);
        // Verhindere Infinite Loops, falls wir nicht ohnehin bereits aufs main Dashboard weiterleiten
        if (seg0 !== "(tabs)" || segments.length > 1) {
          router.replace("/(tabs)");
        }
      }
    }
  }, [segments, userProfile, router]);

  return <>{children}</>;
}
