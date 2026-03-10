import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

const API_BASE = Platform.OS === "web"
    ? (typeof window !== "undefined" ? window.location.origin : "")
    : process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

function formatDate(d: string) {
    if (!d) return "-";
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
}

export default function ContractViewPage() {
    const { token } = useLocalSearchParams<{ token: string }>();
    const colors = useColors();
    const [contract, setContract] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [signName, setSignName] = useState("");
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);

    useEffect(() => {
        if (token) loadContract();
    }, [token]);

    const loadContract = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/public/contracts/${token}`);
            if (!res.ok) throw new Error("Vertrag nicht gefunden");
            const data = await res.json();
            setContract(data);
            if (data.signature_date) setSigned(true);
        } catch (err: any) {
            setError(err.message || "Fehler beim Laden");
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async () => {
        if (!signName.trim()) {
            alert("Bitte geben Sie Ihren vollständigen Namen ein.");
            return;
        }

        setSigning(true);
        try {
            const res = await fetch(`${API_BASE}/api/public/contracts/${token}/sign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: signName.trim() }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Fehler beim Unterzeichnen");
            }
            setSigned(true);
        } catch (err: any) {
            alert(err.message || "Fehler beim Unterzeichnen");
        } finally {
            setSigning(false);
        }
    };

    if (loading) {
        return (
            <ScreenContainer>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="text-muted mt-4">Vertrag wird geladen...</Text>
                </View>
            </ScreenContainer>
        );
    }

    if (error || !contract) {
        return (
            <ScreenContainer>
                <View className="flex-1 items-center justify-center p-6">
                    <IconSymbol name="xmark.circle.fill" size={48} color="#EF4444" />
                    <Text className="text-xl font-bold text-foreground mb-2">
                        Vertrag nicht gefunden
                    </Text>
                    <Text className="text-muted text-center">
                        {error || "Der angeforderte Vertrag konnte nicht geladen werden."}
                    </Text>
                </View>
            </ScreenContainer>
        );
    }

    const customerName = contract.customer
        ? contract.customer.company_name ||
        `${contract.customer.first_name || ""} ${contract.customer.last_name || ""}`.trim()
        : "";

    return (
        <ScreenContainer>
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                {/* Header */}
                <View className="items-center mb-8">
                    <Text className="text-3xl font-bold text-foreground mb-1">
                        Gross ICT
                    </Text>
                    <Text className="text-sm text-muted">
                        Vertrag zur Ansicht und Unterzeichnung
                    </Text>
                </View>

                {/* Contract Card */}
                <View className="bg-surface rounded-2xl border border-border p-6 mb-6">
                    <Text className="text-2xl font-bold text-foreground mb-4">
                        {contract.title}
                    </Text>

                    {customerName ? (
                        <View className="mb-4">
                            <Text className="text-sm text-muted mb-1">Vertragspartner</Text>
                            <Text className="text-base font-semibold text-foreground">
                                {customerName}
                            </Text>
                        </View>
                    ) : null}

                    {contract.description ? (
                        <View className="mb-4">
                            <Text className="text-sm text-muted mb-1">Beschreibung</Text>
                            <Text className="text-base text-foreground">
                                {contract.description}
                            </Text>
                        </View>
                    ) : null}

                    {/* Details Table */}
                    <View className="bg-background rounded-xl p-4 gap-3">
                        <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">Vertragsbeginn</Text>
                            <Text className="text-sm font-semibold text-foreground">
                                {formatDate(contract.start_date)}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">Vertragsende</Text>
                            <Text className="text-sm font-semibold text-foreground">
                                {formatDate(contract.end_date)}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">Jahresbetrag</Text>
                            <Text className="text-sm font-bold text-primary">
                                CHF {Number(contract.annual_amount).toFixed(2)}
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-sm text-muted">Kündigungsfrist</Text>
                            <Text className="text-sm font-semibold text-foreground">
                                {contract.notice_period_months} Monate
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Signature Section */}
                {signed ? (
                    <View className="bg-green-50 border border-green-200 rounded-2xl p-6 items-center">
                        <IconSymbol name="checkmark.seal.fill" size={48} color="#10B981" />
                        <Text className="text-xl font-bold text-green-700 mb-2">
                            Vertrag unterzeichnet
                        </Text>
                        <Text className="text-green-600 text-center">
                            {contract.signature_name
                                ? `Unterzeichnet von ${contract.signature_name}`
                                : "Dieser Vertrag wurde bereits digital unterzeichnet."}
                        </Text>
                        {contract.signature_date && (
                            <Text className="text-green-500 text-sm mt-2">
                                am {new Date(contract.signature_date).toLocaleDateString("de-CH")}
                            </Text>
                        )}
                    </View>
                ) : (
                    <View className="bg-surface rounded-2xl border border-border p-6">
                        <Text className="text-lg font-bold text-foreground mb-4">
                            Vertrag digital unterzeichnen
                        </Text>
                        <Text className="text-sm text-muted mb-4">
                            Mit Ihrer Unterzeichnung stimmen Sie den oben genannten
                            Vertragsbedingungen verbindlich zu. Ihr Name und Ihre IP-Adresse
                            werden als Nachweis der Unterzeichnung gespeichert.
                        </Text>

                        <View className="mb-4">
                            <Text className="text-sm font-semibold text-foreground mb-2">
                                Vollständiger Name *
                            </Text>
                            <TextInput
                                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                                placeholder="Vor- und Nachname"
                                placeholderTextColor={colors.muted}
                                value={signName}
                                onChangeText={setSignName}
                            />
                        </View>

                        <TouchableOpacity
                            className="py-4 rounded-xl items-center"
                            style={{ backgroundColor: colors.primary }}
                            onPress={handleSign}
                            disabled={signing}
                            activeOpacity={0.8}
                        >
                            {signing ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text className="text-background font-bold text-base">
                                    Verbindlich unterzeichnen
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Footer */}
                <View className="items-center mt-8 mb-4">
                    <Text className="text-xs text-muted text-center">
                        Gross ICT · Stefan Gross{"\n"}
                        Dieser Vertrag wurde digital über die Gross ICT Plattform bereitgestellt.
                    </Text>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}
