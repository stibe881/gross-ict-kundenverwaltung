import { Platform } from "react-native";

/**
 * Zeigt Apples eingebaute Händler-Anleitung für Tap to Pay (iOS 18+,
 * ProximityReaderDiscovery — Apple-Review-Anforderung 4.1).
 *
 * @returns true, wenn die Apple-Anleitung angezeigt wurde; false, wenn nicht
 * verfügbar (iOS < 18, Web, Android oder Modul nicht im Build) — dann sollte
 * der Aufrufer die eigene Fallback-Anleitung anzeigen.
 */
export async function showAppleTapToPayEducation(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    const { requireNativeModule } = require("expo-modules-core");
    const mod = requireNativeModule("TapToPayEducation");
    return (await mod.show()) === true;
  } catch (e) {
    console.log("[TapToPay] Apple-Education nicht verfügbar:", e);
    return false;
  }
}
