import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export interface LinkedRecord {
  key: string;
  icon: any;
  color: string;
  title: string;
  subtitle?: string;
  route: string;
  onPress?: () => void; // z.B. um vorher ein Modal zu schliessen
}

// "Verknüpft mit"-Block: zeigt die Kette Angebot ↔ Projekt ↔ Rechnung(en)
export function LinkedRecords({ records, title = "Verknüpft mit" }: { records: LinkedRecord[]; title?: string }) {
  const colors = useColors();
  const router = useRouter();

  if (!records || records.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: colors.muted,
          textTransform: "uppercase",
          letterSpacing: 1,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 6,
        }}
      >
        {title}
      </Text>
      {records.map((r, idx) => (
        <TouchableOpacity
          key={r.key}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: idx > 0 ? 1 : 0,
            borderTopColor: colors.border,
          }}
          activeOpacity={0.7}
          onPress={() => {
            r.onPress?.();
            router.push(r.route as any);
          }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: r.color + "18",
            }}
          >
            <IconSymbol name={r.icon} size={15} color={r.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
              {r.title}
            </Text>
            {!!r.subtitle && (
              <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>
                {r.subtitle}
              </Text>
            )}
          </View>
          <IconSymbol name="chevron.right" size={13} color={colors.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
