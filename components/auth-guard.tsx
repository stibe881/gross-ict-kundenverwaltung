import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Auth-Guard-Komponente zum Schutz von Screens
 * Leitet nicht angemeldete Benutzer automatisch zur Login-Seite weiter
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Benutzer ist nicht angemeldet - zur Login-Seite weiterleiten
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // Zeige Loading während Auth-Check
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Zeige nichts wenn nicht angemeldet (wird weitergeleitet)
  if (!isAuthenticated) {
    return null;
  }

  // Benutzer ist angemeldet - zeige geschützten Content
  return <>{children}</>;
}
