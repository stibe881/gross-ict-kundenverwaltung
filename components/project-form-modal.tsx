import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    ActivityIndicator,
    Platform,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";

interface Props {
    visible: boolean;
    project?: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function ProjectFormModal({ visible, project, onClose, onSuccess }: Props) {
    const colors = useColors();
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [customerId, setCustomerId] = useState("");
    const [budget, setBudget] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("planning");
    const [priority, setPriority] = useState("medium");
    const [notes, setNotes] = useState("");

    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: Data.getCustomersWithCounts,
    });

    useEffect(() => {
        if (project) {
            setTitle(project.title || "");
            setDescription(project.description || "");
            setCustomerId(project.customer_id || "");
            setBudget(project.budget?.toString() || "");
            setStartDate(project.start_date || "");
            setEndDate(project.end_date || "");
            setStatus(project.status || "planning");
            setPriority(project.priority || "medium");
            setNotes(project.notes || "");
        } else {
            setTitle("");
            setDescription("");
            setCustomerId("");
            setBudget("");
            setStartDate(new Date().toISOString().split("T")[0]);
            setEndDate("");
            setStatus("planning");
            setPriority("medium");
            setNotes("");
        }
    }, [project, visible]);

    const handleSave = async () => {
        if (!title.trim()) {
            showAlert("Fehler", "Bitte geben Sie einen Titel ein.");
            return;
        }
        if (!customerId) {
            showAlert("Fehler", "Bitte wählen Sie einen Kunden aus.");
            return;
        }

        setSaving(true);
        try {
            const data = {
                title: title.trim(),
                description: description.trim(),
                customer_id: customerId,
                budget: parseFloat(budget) || 0,
                start_date: startDate || null,
                end_date: endDate || null,
                status,
                priority,
                notes: notes.trim() || null,
            };

            if (project) {
                await Data.updateProject(project.id, data);
            } else {
                await Data.createProject(data);
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setSaving(false);
        }
    };

    const statuses = [
        { key: "planning", label: "Planung", color: "#6B7280" },
        { key: "in_progress", label: "In Arbeit", color: "#3B82F6" },
        { key: "completed", label: "Abgeschlossen", color: "#10B981" },
        { key: "cancelled", label: "Abgebrochen", color: "#EF4444" },
    ];

    const priorities = [
        { key: "low", label: "Niedrig", color: "#6B7280" },
        { key: "medium", label: "Mittel", color: "#F59E0B" },
        { key: "high", label: "Hoch", color: "#EF4444" },
        { key: "urgent", label: "Dringend", color: "#DC2626" },
    ];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header */}
                <View
                    className="flex-row justify-between items-center p-4 border-b"
                    style={{ borderColor: colors.border }}
                >
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{ color: colors.primary, fontSize: 16 }}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-foreground">
                        {project ? "Projekt bearbeiten" : "Neues Projekt"}
                    </Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : (
                            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
                                Speichern
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16 }}>
                    {/* Titel */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Titel *</Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Projekttitel"
                            placeholderTextColor={colors.muted}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>

                    {/* Beschreibung */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Beschreibung</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Projektbeschreibung"
                            placeholderTextColor={colors.muted}
                            multiline
                            numberOfLines={3}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                                textAlignVertical: "top",
                                minHeight: 80,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>

                    {/* Kunde */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Kunde *</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8 }}
                        >
                            {(customers || []).map((c: any) => {
                                const name = c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim();
                                const isSelected = customerId === c.id;
                                return (
                                    <TouchableOpacity
                                        key={c.id}
                                        onPress={() => setCustomerId(c.id)}
                                        style={{
                                            backgroundColor: isSelected ? colors.primary : colors.surface,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                        }}
                                        className="px-4 py-2 rounded-full border"
                                    >
                                        <Text
                                            style={{
                                                color: isSelected ? "#fff" : colors.foreground,
                                                fontSize: 13,
                                                fontWeight: "600",
                                            }}
                                        >
                                            {name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Status */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Status</Text>
                        <View className="flex-row gap-2 flex-wrap">
                            {statuses.map((s) => (
                                <TouchableOpacity
                                    key={s.key}
                                    onPress={() => setStatus(s.key)}
                                    style={{
                                        backgroundColor: status === s.key ? s.color : colors.surface,
                                        borderColor: status === s.key ? s.color : colors.border,
                                    }}
                                    className="px-3 py-1.5 rounded-full border"
                                >
                                    <Text
                                        style={{
                                            color: status === s.key ? "#fff" : colors.foreground,
                                            fontSize: 13,
                                            fontWeight: "600",
                                        }}
                                    >
                                        {s.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Budget */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Budget (CHF)</Text>
                        <TextInput
                            value={budget}
                            onChangeText={setBudget}
                            placeholder="0.00"
                            placeholderTextColor={colors.muted}
                            keyboardType="decimal-pad"
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>

                    {/* Datum */}
                    <View className="flex-row gap-4">
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-foreground mb-2">Startdatum</Text>
                            <TextInput
                                value={startDate}
                                onChangeText={setStartDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.muted}
                                style={{
                                    backgroundColor: colors.surface,
                                    color: colors.foreground,
                                    borderColor: colors.border,
                                }}
                                className="p-3 rounded-lg border text-base"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-foreground mb-2">Enddatum</Text>
                            <TextInput
                                value={endDate}
                                onChangeText={setEndDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.muted}
                                style={{
                                    backgroundColor: colors.surface,
                                    color: colors.foreground,
                                    borderColor: colors.border,
                                }}
                                className="p-3 rounded-lg border text-base"
                            />
                        </View>
                    </View>

                    {/* Priorität */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Priorität</Text>
                        <View className="flex-row gap-2 flex-wrap">
                            {priorities.map((p) => (
                                <TouchableOpacity
                                    key={p.key}
                                    onPress={() => setPriority(p.key)}
                                    style={{
                                        backgroundColor: priority === p.key ? p.color : colors.surface,
                                        borderColor: priority === p.key ? p.color : colors.border,
                                    }}
                                    className="px-3 py-1.5 rounded-full border"
                                >
                                    <Text
                                        style={{
                                            color: priority === p.key ? "#fff" : colors.foreground,
                                            fontSize: 13,
                                            fontWeight: "600",
                                        }}
                                    >
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Notizen */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Notizen</Text>
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Interne Notizen zum Projekt..."
                            placeholderTextColor={colors.muted}
                            multiline
                            numberOfLines={3}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                                textAlignVertical: "top",
                                minHeight: 80,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}
