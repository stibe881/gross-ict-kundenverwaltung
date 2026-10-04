import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";

// Einsatzplan: Wochenansicht mit Tickets, Aufgaben, Wartungsfenstern und Abwesenheiten.

function mondayOf(d: Date): Date {
    const copy = new Date(d);
    const day = (copy.getDay() + 6) % 7; // Mo=0
    copy.setDate(copy.getDate() - day);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

const DAY_LABELS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export default function EinsatzplanScreen() {
    const colors = useColors();
    const router = useRouter();
    const { containerStyle, contentPadding, isWide } = useResponsiveLayout();
    const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

    const weekIso = weekStart.toISOString().split("T")[0];
    const { data, isLoading } = useQuery({
        queryKey: ["weekPlan", weekIso],
        queryFn: () => Data.getWeekPlan(weekIso),
    });

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart.getTime() + i * 86400000);
        return { date: d, iso: d.toISOString().split("T")[0] };
    });
    const todayIso = new Date().toISOString().split("T")[0];

    const shiftWeek = (dir: number) =>
        setWeekStart(new Date(weekStart.getTime() + dir * 7 * 86400000));

    const fmtRange = () => {
        const end = new Date(weekStart.getTime() + 6 * 86400000);
        return `${weekStart.getDate()}.${weekStart.getMonth() + 1}. – ${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
    };

    const prioColor = (p: string) => (p === "urgent" ? "#DC2626" : p === "high" ? "#EF4444" : p === "medium" ? "#F59E0B" : "#6B7280");
    const absColor = (t: string) => (t === "vacation" ? "#0EA5E9" : t === "sick" ? "#EF4444" : "#6B7280");
    const absLabel = (t: string) => (t === "vacation" ? "Ferien" : t === "sick" ? "Krank" : "Abwesend");

    const itemsForDay = (iso: string) => {
        const tickets = ((data?.tickets as any[]) || []).filter((t) => t.due_date === iso);
        const tasks = ((data?.tasks as any[]) || []).filter((t) => t.due_date === iso);
        const maint = ((data?.maintenance as any[]) || []).filter((m) => String(m.starts_at).split("T")[0] === iso);
        const abs = ((data?.absences as any[]) || []).filter((a) => a.start_date <= iso && a.end_date >= iso);
        return { tickets, tasks, maint, abs, total: tickets.length + tasks.length + maint.length + abs.length };
    };

    const DayColumn = ({ day }: { day: { date: Date; iso: string } }) => {
        const { tickets, tasks, maint, abs, total } = itemsForDay(day.iso);
        const isToday = day.iso === todayIso;
        return (
            <View
                style={{
                    flex: isWide ? 1 : undefined,
                    minWidth: 0,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isToday ? colors.primary : colors.border,
                    padding: 10,
                    marginBottom: isWide ? 0 : 10,
                }}
            >
                <Text style={{ fontSize: 12, fontWeight: "700", color: isToday ? colors.primary : colors.foreground }}>
                    {DAY_LABELS[(day.date.getDay() + 6) % 7]}
                </Text>
                <Text style={{ fontSize: 10.5, color: colors.muted, marginBottom: 8 }}>
                    {day.date.getDate()}.{day.date.getMonth() + 1}.{isToday ? " · heute" : ""}
                </Text>

                {total === 0 ? (
                    <Text style={{ fontSize: 11, color: colors.muted }}>–</Text>
                ) : (
                    <>
                        {abs.map((a: any) => (
                            <View key={`a-${a.id}`} style={{ backgroundColor: absColor(a.type) + "18", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, marginBottom: 5 }}>
                                <Text style={{ fontSize: 10.5, fontWeight: "700", color: absColor(a.type) }} numberOfLines={1}>
                                    {a.user?.name || "?"} · {absLabel(a.type)}
                                </Text>
                            </View>
                        ))}
                        {maint.map((m: any) => (
                            <View key={`m-${m.id}`} style={{ backgroundColor: "#0EA5E918", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, marginBottom: 5 }}>
                                <Text style={{ fontSize: 10.5, fontWeight: "600", color: "#0EA5E9" }} numberOfLines={2}>
                                    🔧 {m.title} ({new Date(m.starts_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })})
                                </Text>
                            </View>
                        ))}
                        {tickets.map((t: any) => (
                            <TouchableOpacity
                                key={`t-${t.id}`}
                                style={{ backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: prioColor(t.priority), borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, marginBottom: 5 }}
                                onPress={() => router.push(`/tickets?ticketId=${t.id}` as any)}
                                activeOpacity={0.7}
                            >
                                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{t.title}</Text>
                                <Text style={{ fontSize: 9.5, color: colors.muted }} numberOfLines={1}>
                                    Ticket{t.assignee?.name ? ` · ${t.assignee.name}` : ""}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        {tasks.map((t: any) => (
                            <TouchableOpacity
                                key={`k-${t.id}`}
                                style={{ backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: "#8B5CF6", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, marginBottom: 5 }}
                                onPress={() => router.push("/tasks" as any)}
                                activeOpacity={0.7}
                            >
                                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{t.title}</Text>
                                <Text style={{ fontSize: 9.5, color: colors.muted }} numberOfLines={1}>
                                    Aufgabe{t.assigned_user?.name ? ` · ${t.assigned_user.name}` : ""}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </>
                )}
            </View>
        );
    };

    return (
        <ScreenContainer>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View style={{ padding: contentPadding }}>
                    <View style={containerStyle}>
                        <View className="flex-row items-center gap-3 mb-1">
                            <BackButton />
                            <Text className="text-2xl font-bold text-foreground">Einsatzplan</Text>
                        </View>
                        <Text className="text-sm text-muted mb-4">
                            Tickets, Aufgaben, Wartungsfenster und Abwesenheiten der Woche.
                        </Text>

                        {/* Wochen-Navigation */}
                        <View className="flex-row items-center justify-center gap-4 mb-4">
                            <TouchableOpacity onPress={() => shiftWeek(-1)} activeOpacity={0.7} style={{ padding: 6 }}>
                                <IconSymbol name="chevron.left" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setWeekStart(mondayOf(new Date()))} activeOpacity={0.7}>
                                <Text className="text-base font-bold text-foreground">{fmtRange()}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => shiftWeek(1)} activeOpacity={0.7} style={{ padding: 6 }}>
                                <IconSymbol name="chevron.right" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>

                        {isLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
                        ) : isWide ? (
                            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                                {days.map((d) => <DayColumn key={d.iso} day={d} />)}
                            </View>
                        ) : (
                            <View>
                                {days.map((d) => <DayColumn key={d.iso} day={d} />)}
                            </View>
                        )}

                        <View style={{ height: 24 }} />
                    </View>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}
