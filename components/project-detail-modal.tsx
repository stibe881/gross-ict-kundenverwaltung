import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Data from "@/lib/data";
import { formatDate, formatCurrency } from "@/lib/format";
import { showAlert } from "@/lib/alert";
import { ProjectFormModal } from "./project-form-modal";

interface Props {
    visible: boolean;
    project: any;
    onClose: () => void;
    onUpdate: () => void;
}

const MILESTONE_ICONS: Record<string, string> = {
    pending: "⏳",
    in_progress: "🔄",
    completed: "✅",
};

const MILESTONE_COLORS: Record<string, string> = {
    pending: "#6B7280",
    in_progress: "#3B82F6",
    completed: "#10B981",
};

export function ProjectDetailModal({ visible, project, onClose, onUpdate }: Props) {
    const colors = useColors();
    const [milestones, setMilestones] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
    const [addingMilestone, setAddingMilestone] = useState(false);
    const [showMilestoneInput, setShowMilestoneInput] = useState(false);

    useEffect(() => {
        if (visible && project) {
            loadMilestones();
        }
    }, [visible, project]);

    const loadMilestones = async () => {
        setLoading(true);
        try {
            const data = await Data.getProjectMilestones(project.id);
            setMilestones(data);
        } catch (error) {
            console.error("Failed to load milestones:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMilestone = async () => {
        if (!newMilestoneTitle.trim()) return;
        setAddingMilestone(true);
        try {
            await Data.createMilestone({
                project_id: project.id,
                title: newMilestoneTitle.trim(),
                status: "pending",
                sort_order: milestones.length,
            });
            setNewMilestoneTitle("");
            setShowMilestoneInput(false);
            await loadMilestones();
            onUpdate();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setAddingMilestone(false);
        }
    };

    const handleToggleMilestone = async (milestone: any) => {
        const nextStatus = milestone.status === "completed" ? "pending"
            : milestone.status === "in_progress" ? "completed"
                : "in_progress";

        try {
            await Data.updateMilestone(milestone.id, {
                status: nextStatus,
                completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
            });
            await loadMilestones();
            onUpdate();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        }
    };

    const handleDeleteMilestone = (milestone: any) => {
        Alert.alert(
            "Meilenstein löschen",
            `"${milestone.title}" wirklich löschen?`,
            [
                { text: "Abbrechen", style: "cancel" },
                {
                    text: "Löschen",
                    style: "destructive",
                    onPress: async () => {
                        await Data.deleteMilestone(milestone.id);
                        await loadMilestones();
                        onUpdate();
                    },
                },
            ]
        );
    };

    const completedCount = milestones.filter((m) => m.status === "completed").length;
    const progressPercent = milestones.length > 0
        ? Math.round((completedCount / milestones.length) * 100)
        : 0;

    const STATUS_LABELS: Record<string, string> = {
        planning: "📋 Planung",
        in_progress: "🔄 In Arbeit",
        completed: "✅ Abgeschlossen",
        cancelled: "❌ Abgebrochen",
    };

    return (
        <>
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    {/* Header */}
                    <View
                        className="flex-row justify-between items-center p-4 border-b"
                        style={{ borderColor: colors.border }}
                    >
                        <TouchableOpacity onPress={onClose}>
                            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
                            {project.project_number}
                        </Text>
                        <TouchableOpacity onPress={() => setShowEditModal(true)}>
                            <IconSymbol name="pencil" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 20 }}>
                        {/* Project Info */}
                        <View className="bg-surface rounded-xl p-4 border border-border">
                            <Text className="text-xl font-bold text-foreground">{project.title}</Text>
                            {project.description ? (
                                <Text className="text-sm text-muted mt-2">{project.description}</Text>
                            ) : null}

                            <View className="flex-row flex-wrap gap-4 mt-4">
                                <View>
                                    <Text className="text-xs text-muted">Status</Text>
                                    <Text className="text-sm font-semibold text-foreground">
                                        {STATUS_LABELS[project.status] || project.status}
                                    </Text>
                                </View>
                                <View>
                                    <Text className="text-xs text-muted">Kunde</Text>
                                    <Text className="text-sm font-semibold text-foreground">
                                        {project.customer?.company_name ||
                                            `${project.customer?.first_name || ""} ${project.customer?.last_name || ""}`.trim() ||
                                            "—"}
                                    </Text>
                                </View>
                                {project.budget > 0 && (
                                    <View>
                                        <Text className="text-xs text-muted">Budget</Text>
                                        <Text className="text-sm font-semibold text-foreground">
                                            {formatCurrency(project.budget)}
                                        </Text>
                                    </View>
                                )}
                                {project.start_date && (
                                    <View>
                                        <Text className="text-xs text-muted">Zeitraum</Text>
                                        <Text className="text-sm font-semibold text-foreground">
                                            {formatDate(project.start_date)}
                                            {project.end_date ? ` – ${formatDate(project.end_date)}` : ""}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Progress */}
                        {milestones.length > 0 && (
                            <View className="bg-surface rounded-xl p-4 border border-border">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="text-base font-bold text-foreground">Fortschritt</Text>
                                    <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                                        {progressPercent}%
                                    </Text>
                                </View>
                                <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4 }}>
                                    <View
                                        style={{
                                            height: 8,
                                            width: `${progressPercent}%`,
                                            backgroundColor: colors.primary,
                                            borderRadius: 4,
                                        }}
                                    />
                                </View>
                                <Text className="text-xs text-muted mt-2">
                                    {completedCount} von {milestones.length} Meilensteinen abgeschlossen
                                </Text>
                            </View>
                        )}

                        {/* Timeline */}
                        <View>
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-base font-bold text-foreground">
                                    Timeline / Meilensteine
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowMilestoneInput(!showMilestoneInput)}
                                    style={{ backgroundColor: colors.primary + "20" }}
                                    className="w-8 h-8 rounded-full items-center justify-center"
                                >
                                    <IconSymbol
                                        name={showMilestoneInput ? "xmark" : "plus"}
                                        size={16}
                                        color={colors.primary}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Add Milestone Input */}
                            {showMilestoneInput && (
                                <View className="flex-row gap-2 mb-4">
                                    <TextInput
                                        value={newMilestoneTitle}
                                        onChangeText={setNewMilestoneTitle}
                                        placeholder="Neuer Meilenstein..."
                                        placeholderTextColor={colors.muted}
                                        style={{
                                            backgroundColor: colors.surface,
                                            color: colors.foreground,
                                            borderColor: colors.border,
                                            flex: 1,
                                        }}
                                        className="p-3 rounded-lg border text-base"
                                        onSubmitEditing={handleAddMilestone}
                                    />
                                    <TouchableOpacity
                                        onPress={handleAddMilestone}
                                        disabled={addingMilestone || !newMilestoneTitle.trim()}
                                        style={{
                                            backgroundColor: colors.primary,
                                            opacity: addingMilestone || !newMilestoneTitle.trim() ? 0.5 : 1,
                                        }}
                                        className="w-12 rounded-lg items-center justify-center"
                                    >
                                        {addingMilestone ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <IconSymbol name="checkmark" size={18} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {loading ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : milestones.length === 0 ? (
                                <View className="items-center py-8">
                                    <Text className="text-muted text-sm">
                                        Noch keine Meilensteine. Tippe + um einen hinzuzufügen.
                                    </Text>
                                </View>
                            ) : (
                                <View>
                                    {milestones.map((milestone, index) => {
                                        const isLast = index === milestones.length - 1;
                                        const statusColor = MILESTONE_COLORS[milestone.status] || "#6B7280";
                                        const icon = MILESTONE_ICONS[milestone.status] || "⏳";

                                        return (
                                            <View key={milestone.id} className="flex-row">
                                                {/* Timeline Line */}
                                                <View className="items-center" style={{ width: 40 }}>
                                                    <View
                                                        style={{
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: 14,
                                                            backgroundColor: statusColor + "20",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 14 }}>{icon}</Text>
                                                    </View>
                                                    {!isLast && (
                                                        <View
                                                            style={{
                                                                width: 2,
                                                                flex: 1,
                                                                backgroundColor: statusColor + "30",
                                                                minHeight: 20,
                                                            }}
                                                        />
                                                    )}
                                                </View>

                                                {/* Content */}
                                                <TouchableOpacity
                                                    className="flex-1 pb-4 ml-2"
                                                    onPress={() => handleToggleMilestone(milestone)}
                                                    onLongPress={() => handleDeleteMilestone(milestone)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View className="bg-surface rounded-lg p-3 border border-border">
                                                        <Text
                                                            className="text-sm font-semibold"
                                                            style={{
                                                                color: colors.foreground,
                                                                textDecorationLine: milestone.status === "completed" ? "line-through" : "none",
                                                            }}
                                                        >
                                                            {milestone.title}
                                                        </Text>
                                                        {milestone.description && (
                                                            <Text className="text-xs text-muted mt-1">
                                                                {milestone.description}
                                                            </Text>
                                                        )}
                                                        <View className="flex-row justify-between mt-2">
                                                            <Text className="text-xs" style={{ color: statusColor }}>
                                                                {milestone.status === "completed" ? "Abgeschlossen" :
                                                                    milestone.status === "in_progress" ? "In Arbeit" : "Ausstehend"}
                                                            </Text>
                                                            {milestone.completed_at && (
                                                                <Text className="text-xs text-muted">
                                                                    {formatDate(milestone.completed_at)}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            <ProjectFormModal
                visible={showEditModal}
                project={project}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => {
                    onUpdate();
                    loadMilestones();
                }}
            />
        </>
    );
}
