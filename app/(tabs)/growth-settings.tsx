import { useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";

// Kundengewinnung: Willkommenspaket, Google-Review-Automatik und Anruf-Skript
// – alles ein-/ausschaltbar und anpassbar.
export default function GrowthSettingsScreen() {
    const colors = useColors();
    const queryClient = useQueryClient();
    const { containerStyle, contentPadding } = useResponsiveLayout();

    const { data: settings = {} } = useQuery({
        queryKey: ["marketingSettings"],
        queryFn: Data.getMarketingSettings,
    });

    const [welcomeEnabled, setWelcomeEnabled] = useState(false);
    const [welcomeSubject, setWelcomeSubject] = useState("");
    const [welcomeBody, setWelcomeBody] = useState("");
    const [reviewEnabled, setReviewEnabled] = useState(false);
    const [reviewLink, setReviewLink] = useState("");
    const [callScript, setCallScript] = useState("");
    const [weeklyGoal, setWeeklyGoal] = useState("10");
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (loaded || !Object.keys(settings as any).length) return;
        const s = settings as any;
        setWelcomeEnabled(s.welcome_enabled === "true");
        setWelcomeSubject(s.welcome_subject || "Herzlich willkommen bei Gross ICT");
        setWelcomeBody(s.welcome_body || "Guten Tag {name}\n\nHerzlich willkommen bei Gross ICT! Wir freuen uns auf die Zusammenarbeit.\n\nBei Fragen sind wir jederzeit für Sie da.\n\nFreundliche Grüsse\nGross ICT");
        setReviewEnabled(s.review_auto_enabled === "true");
        setReviewLink(s.review_link || "");
        setCallScript(s.call_script || "Guten Tag, Stefan Gross von Gross ICT aus der Region. Wir unterstützen KMU bei IT, Webseite und Microsoft 365.\n\nDarf ich fragen, wer sich bei Ihnen aktuell um die IT kümmert?\n\n→ Ziel: 15-Minuten-Kennenlerntermin vereinbaren.");
        setWeeklyGoal(s.weekly_contact_goal || "10");
        setLoaded(true);
    }, [settings, loaded]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                Data.setMarketingSetting("welcome_enabled", welcomeEnabled ? "true" : "false"),
                Data.setMarketingSetting("welcome_subject", welcomeSubject.trim()),
                Data.setMarketingSetting("welcome_body", welcomeBody.trim()),
                Data.setMarketingSetting("review_auto_enabled", reviewEnabled ? "true" : "false"),
                Data.setMarketingSetting("review_link", reviewLink.trim()),
                Data.setMarketingSetting("call_script", callScript.trim()),
                Data.setMarketingSetting("weekly_contact_goal", String(parseInt(weeklyGoal, 10) || 10)),
            ]);
            queryClient.invalidateQueries({ queryKey: ["marketingSettings"] });
            showToast("Einstellungen gespeichert");
        } catch (e: any) {
            showAlert("Fehler", e.message);
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
        <TouchableOpacity
            style={{
                width: 46, height: 28, borderRadius: 14, paddingHorizontal: 2, justifyContent: "center",
                backgroundColor: value ? "#22C55E" : colors.border,
            }}
            onPress={onToggle}
            activeOpacity={0.8}
        >
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFF", alignSelf: value ? "flex-end" : "flex-start" }} />
        </TouchableOpacity>
    );

    const inputStyle = {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.foreground,
        fontSize: 14,
    } as const;

    return (
        <ScreenContainer>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View style={{ padding: contentPadding }}>
                    <View style={containerStyle}>
                        <View className="flex-row items-center gap-3 mb-1">
                            <BackButton to="/settings" />
                            <Text className="text-2xl font-bold text-foreground">Kundengewinnung</Text>
                        </View>
                        <Text className="text-sm text-muted mb-5">
                            Willkommenspaket, Google-Bewertungen und Anruf-Skript – alles anpassbar.
                        </Text>

                        {/* Willkommenspaket */}
                        <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
                            <View className="flex-row items-center justify-between mb-1">
                                <View className="flex-row items-center gap-2">
                                    <IconSymbol name="hand.wave.fill" size={16} color="#F59E0B" />
                                    <Text className="text-base font-bold text-foreground">Willkommenspaket</Text>
                                </View>
                                <Toggle value={welcomeEnabled} onToggle={() => setWelcomeEnabled(!welcomeEnabled)} />
                            </View>
                            <Text className="text-xs text-muted mb-3">
                                Sendet neuen Kunden mit E-Mail-Adresse automatisch eine Willkommens-Mail. {"{name}"} wird ersetzt.
                            </Text>
                            <Text className="text-xs font-semibold text-muted mb-1">Betreff</Text>
                            <TextInput value={welcomeSubject} onChangeText={setWelcomeSubject} style={inputStyle} placeholderTextColor={colors.muted} />
                            <Text className="text-xs font-semibold text-muted mb-1 mt-3">Nachricht</Text>
                            <TextInput
                                value={welcomeBody} onChangeText={setWelcomeBody} multiline
                                style={[inputStyle, { minHeight: 140, textAlignVertical: "top" }]}
                                placeholderTextColor={colors.muted}
                            />
                        </View>

                        {/* Google-Bewertungen */}
                        <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
                            <View className="flex-row items-center justify-between mb-1">
                                <View className="flex-row items-center gap-2">
                                    <IconSymbol name="star.fill" size={16} color="#FBBF24" />
                                    <Text className="text-base font-bold text-foreground">Google-Bewertungs-Mails</Text>
                                </View>
                                <Toggle value={reviewEnabled} onToggle={() => setReviewEnabled(!reviewEnabled)} />
                            </View>
                            <Text className="text-xs text-muted mb-3">
                                Bittet Kunden einen Tag nach einem geschlossenen Ticket per Mail um eine Google-Bewertung
                                (höchstens alle 6 Monate pro Kunde). Läuft über den täglichen Automatik-Lauf um 06:00.
                            </Text>
                            <Text className="text-xs font-semibold text-muted mb-1">Google-Review-Link</Text>
                            <TextInput
                                value={reviewLink} onChangeText={setReviewLink}
                                placeholder="https://g.page/r/.../review"
                                placeholderTextColor={colors.muted}
                                style={inputStyle}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Anruf-Skript */}
                        <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
                            <View className="flex-row items-center gap-2 mb-1">
                                <IconSymbol name="phone.fill" size={16} color="#0EA5E9" />
                                <Text className="text-base font-bold text-foreground">Anruf-Skript (Akquise)</Text>
                            </View>
                            <Text className="text-xs text-muted mb-3">
                                Wird im Anruf-Modus der Akquise als Leitfaden angezeigt.
                            </Text>
                            <TextInput
                                value={callScript} onChangeText={setCallScript} multiline
                                style={[inputStyle, { minHeight: 140, textAlignVertical: "top" }]}
                                placeholderTextColor={colors.muted}
                            />
                        </View>

                        {/* Wochenziel Akquise */}
                        <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
                            <View className="flex-row items-center gap-2 mb-1">
                                <IconSymbol name="flame.fill" size={16} color="#FB923C" />
                                <Text className="text-base font-bold text-foreground">Wochenziel Kontakte</Text>
                            </View>
                            <Text className="text-xs text-muted mb-3">
                                So viele protokollierte Kontakte (Anrufe, Mails, Aktivitäten) pro Woche peilen Sie an — als Fortschrittsbalken im Akquise-Cockpit sichtbar.
                            </Text>
                            <TextInput
                                value={weeklyGoal} onChangeText={setWeeklyGoal} keyboardType="number-pad"
                                style={[inputStyle, { width: 120 }]}
                                placeholderTextColor={colors.muted}
                            />
                        </View>

                        <TouchableOpacity
                            className="bg-primary py-3.5 rounded-xl items-center mb-8"
                            onPress={handleSave}
                            disabled={saving}
                            activeOpacity={0.8}
                        >
                            {saving ? <ActivityIndicator size="small" color={colors.background} /> : (
                                <Text className="font-bold text-background">Speichern</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}
