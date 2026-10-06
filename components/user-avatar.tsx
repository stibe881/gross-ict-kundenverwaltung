import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * Profilbild robust anzeigen: zuerst users.avatar_url, sonst direkt die
 * Storage-Datei avatars/<userId>.jpg aus dem öffentlichen Bucket. Damit hängt
 * die Anzeige nicht mehr am Datenbankfeld, das ältere App-Versionen beim
 * Profil-Abgleich verlieren konnten. Lädt das Bild nicht, erscheinen die
 * Initialen.
 */
export function UserAvatar({
  userId,
  avatarUrl,
  initials,
  size,
  backgroundColor,
  textColor = "#FFF",
}: {
  userId?: string | null;
  avatarUrl?: string | null;
  initials: string;
  size: number;
  backgroundColor: string;
  textColor?: string;
}) {
  const uri =
    avatarUrl ||
    (userId ? supabase.storage.from("avatars").getPublicUrl(`${userId}.jpg`).data.publicUrl : undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: textColor, fontSize: Math.round(size * 0.38), fontWeight: "700" }}>
        {initials}
      </Text>
    </View>
  );
}
