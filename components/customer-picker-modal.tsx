import { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Data from "@/lib/data";

// Einfache Kundenauswahl, z.B. für "Als Kopie für anderen Kunden".
// onSelect(null) = gleicher Kunde behalten.
export function CustomerPickerModal({
    visible,
    title,
    onClose,
    onSelect,
    allowSame = true,
}: {
    visible: boolean;
    title: string;
    onClose: () => void;
    onSelect: (customerId: string | null) => void;
    allowSame?: boolean;
}) {
    const colors = useColors();
    const [search, setSearch] = useState("");

    const { data: customers = [] } = useQuery({
        queryKey: ["customers"],
        queryFn: Data.getCustomersWithCounts,
        enabled: visible,
    });

    const name = (c: any) => c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "–";
    const filtered = (customers as any[]).filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return name(c).toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
    });

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" }}>
                    <View className="flex-row items-center justify-between p-4 border-b border-border">
                        <Text className="text-lg font-bold text-foreground">{title}</Text>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                            <IconSymbol name="xmark.circle.fill" size={26} color={colors.muted} />
                        </TouchableOpacity>
                    </View>
                    <View className="p-4">
                        {allowSame ? (
                            <TouchableOpacity
                                className="bg-primary py-3 rounded-xl items-center mb-3"
                                onPress={() => { setSearch(""); onSelect(null); }}
                                activeOpacity={0.8}
                            >
                                <Text className="font-bold text-background">Gleicher Kunde</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Anderen Kunden suchen…"
                            placeholderTextColor={colors.muted}
                            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-2"
                        />
                        <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                            {filtered.slice(0, 30).map((c: any) => (
                                <TouchableOpacity
                                    key={c.id}
                                    className="px-3 py-2.5 border-b border-border/50"
                                    onPress={() => { setSearch(""); onSelect(c.id); }}
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-sm font-semibold text-foreground">{name(c)}</Text>
                                    {c.email ? <Text className="text-xs text-muted">{c.email}</Text> : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <View style={{ height: 16 }} />
                    </View>
                </View>
            </View>
        </Modal>
    );
}
