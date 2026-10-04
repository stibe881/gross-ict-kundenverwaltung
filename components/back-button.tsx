import { TouchableOpacity, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// Zurück-Pfeil für Screen-Header: auf Desktop-Web (Seitenleiste vorhanden)
// unnötig und darum ausgeblendet; mobil und in den Apps sichtbar.
export function BackButton({ to }: { to?: string }) {
    const { width } = useWindowDimensions();
    const router = useRouter();
    const colors = useColors();

    if (Platform.OS === "web" && width > 900) return null;

    return (
        <TouchableOpacity
            onPress={() => (to ? router.push(to as any) : router.back())}
            activeOpacity={0.7}
        >
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
    );
}
