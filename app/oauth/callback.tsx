import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";

export default function OAuthCallback() {
  const router = useRouter();
  const colors = useColors();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Listen for Supabase auth state changes.
    // When the page loads with #access_token=..., the Supabase client automatically
    // detects and processes the tokens. We listen for the SIGNED_IN event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[OAuth Callback] Auth event:", event);

        if (event === "SIGNED_IN" && session) {
          console.log("[OAuth Callback] User signed in:", session.user.email);

          // Persist login state for the app
          await AsyncStorage.setItem("isLoggedIn", "true");
          await AsyncStorage.setItem("userEmail", session.user.email || "");
          await AsyncStorage.setItem(
            "userName",
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email || ""
          );

          setStatus("success");
          setTimeout(() => router.replace("/(tabs)"), 300);
        }
      }
    );

    // Fallback: if the session was already detected before our listener was set up
    const checkExistingSession = async () => {
      // Small delay to let Supabase process the URL hash first
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("[OAuth Callback] Existing session found:", session.user.email);
        await AsyncStorage.setItem("isLoggedIn", "true");
        await AsyncStorage.setItem("userEmail", session.user.email || "");
        await AsyncStorage.setItem(
          "userName",
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email || ""
        );
        setStatus("success");
        setTimeout(() => router.replace("/(tabs)"), 300);
      } else {
        // Wait a bit more and try again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession) {
          await AsyncStorage.setItem("isLoggedIn", "true");
          await AsyncStorage.setItem("userEmail", retrySession.user.email || "");
          await AsyncStorage.setItem(
            "userName",
            retrySession.user.user_metadata?.full_name ||
            retrySession.user.user_metadata?.name ||
            retrySession.user.email || ""
          );
          setStatus("success");
          setTimeout(() => router.replace("/(tabs)"), 300);
        } else {
          console.error("[OAuth Callback] No session found after waiting");
          setStatus("error");
          setErrorMsg("Keine Session gefunden. Bitte versuchen Sie es erneut.");
        }
      }
    };

    checkExistingSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        padding: 24,
      }}
    >
      {status === "processing" && (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.foreground, marginTop: 16, fontSize: 16 }}>
            Anmeldung wird abgeschlossen...
          </Text>
        </>
      )}
      {status === "success" && (
        <Text style={{ color: colors.success, fontSize: 16, fontWeight: "600" }}>
          ✓ Anmeldung erfolgreich — Weiterleitung...
        </Text>
      )}
      {status === "error" && (
        <>
          <Text style={{ color: colors.error, fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
            Anmeldung fehlgeschlagen
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
            {errorMsg}
          </Text>
        </>
      )}
    </View>
  );
}
