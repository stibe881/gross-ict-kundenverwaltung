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

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    low: { label: "Niedrig", color: "#6B7280", icon: "⬇️" },
    medium: { label: "Mittel", color: "#F59E0B", icon: "➡️" },
    high: { label: "Hoch", color: "#EF4444", icon: "⬆️" },
    urgent: { label: "Dringend", color: "#DC2626", icon: "🔥" },
};

const STATUS_LABELS: Record<string, string> = {
    planning: "📋 Planung",
    in_progress: "🔄 In Arbeit",
    completed: "✅ Abgeschlossen",
    cancelled: "❌ Abgebrochen",
};

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

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    open: { label: "Offen", color: "#6B7280", icon: "○" },
    in_progress: { label: "In Arbeit", color: "#3B82F6", icon: "◐" },
    done: { label: "Erledigt", color: "#10B981", icon: "●" },
};

const ACTIVITY_ICONS: Record<string, string> = {
    note: "📝",
    status_change: "🔄",
    milestone: "🏁",
    task: "✓",
    system: "⚙️",
};

type TabKey = "overview" | "timeline" | "tasks" | "documents";

export function ProjectDetailModal({ visible, project, onClose, onUpdate }: Props) {
    const colors = useColors();
    const [activeTab, setActiveTab] = useState<TabKey>("overview");
    const [showEditModal, setShowEditModal] = useState(false);

    // Milestones
    const [milestones, setMilestones] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showMilestoneInput, setShowMilestoneInput] = useState(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
    const [addingMilestone, setAddingMilestone] = useState(false);

    // Timeline
    const [activities, setActivities] = useState<any[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [addingNote, setAddingNote] = useState(false);

    // Tasks
    const [tasks, setTasks] = useState<any[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [addingTask, setAddingTask] = useState(false);
    const [showTaskInput, setShowTaskInput] = useState(false);

    // Documents
    const [linkedQuotes, setLinkedQuotes] = useState<any[]>([]);
    const [linkedInvoices, setLinkedInvoices] = useState<any[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);

    useEffect(() => {
        if (visible && project) {
            setActiveTab("overview");
            loadMilestones();
        }
    }, [visible, project]);

    useEffect(() => {
        if (visible && project) {
            if (activeTab === "timeline") loadActivities();
            if (activeTab === "tasks") loadTasks();
            if (activeTab === "documents") loadDocuments();
        }
    }, [activeTab, visible, project]);

    // ---- Data Loading ----
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

    const loadActivities = async () => {
        setLoadingActivities(true);
        try {
            const data = await Data.getProjectActivities(project.id);
            setActivities(data);
        } catch (error) {
            console.error("Failed to load activities:", error);
        } finally {
            setLoadingActivities(false);
        }
    };

    const loadTasks = async () => {
        setLoadingTasks(true);
        try {
            const data = await Data.getProjectTasks(project.id);
            setTasks(data);
        } catch (error) {
            console.error("Failed to load tasks:", error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const loadDocuments = async () => {
        setLoadingDocs(true);
        try {
            const [quotes, invoices] = await Promise.all([
                Data.getProjectQuotes(project.id),
                Data.getProjectInvoices(project.id),
            ]);
            setLinkedQuotes(quotes);
            setLinkedInvoices(invoices);
        } catch (error) {
            console.error("Failed to load documents:", error);
        } finally {
            setLoadingDocs(false);
        }
    };

    // ---- Milestone Actions ----
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
            // Log activity
            try {
                const statusLabel = nextStatus === "completed" ? "abgeschlossen" : nextStatus === "in_progress" ? "gestartet" : "zurückgesetzt";
                await Data.addProjectActivity(project.id, "milestone", `Meilenstein "${milestone.title}" ${statusLabel}`);
            } catch (_) { /* non-critical */ }
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

    // ---- Activity Actions ----
    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        setAddingNote(true);
        try {
            await Data.addProjectActivity(project.id, "note", newNote.trim());
            setNewNote("");
            await loadActivities();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setAddingNote(false);
        }
    };

    // ---- Task Actions ----
    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;
        setAddingTask(true);
        try {
            await Data.createProjectTask({
                project_id: project.id,
                title: newTaskTitle.trim(),
                status: "open",
                sort_order: tasks.length,
            });
            setNewTaskTitle("");
            setShowTaskInput(false);
            await loadTasks();
            // Log activity
            try {
                await Data.addProjectActivity(project.id, "task", `Aufgabe "${newTaskTitle.trim()}" erstellt`);
            } catch (_) { /* non-critical */ }
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setAddingTask(false);
        }
    };

    const handleToggleTask = async (task: any) => {
        const nextStatus = task.status === "done" ? "open"
            : task.status === "in_progress" ? "done"
                : "in_progress";

        try {
            await Data.updateProjectTask(task.id, { status: nextStatus });
            await loadTasks();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        }
    };

    const handleDeleteTask = (task: any) => {
        Alert.alert(
            "Aufgabe löschen",
            `"${task.title}" wirklich löschen?`,
            [
                { text: "Abbrechen", style: "cancel" },
                {
                    text: "Löschen",
                    style: "destructive",
                    onPress: async () => {
                        await Data.deleteProjectTask(task.id);
                        await loadTasks();
                    },
                },
            ]
        );
    };

    // ---- Computed ----
    const completedCount = milestones.filter((m) => m.status === "completed").length;
    const progressPercent = milestones.length > 0
        ? Math.round((completedCount / milestones.length) * 100)
        : 0;

    const priorityConfig = PRIORITY_CONFIG[project?.priority] || PRIORITY_CONFIG.medium;

    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: "overview", label: "Übersicht", icon: "info.circle" },
        { key: "timeline", label: "Timeline", icon: "clock" },
        { key: "tasks", label: "Aufgaben", icon: "checklist" },
        { key: "documents", label: "Dokumente", icon: "doc.text" },
    ];

    // ---- Render Sections ----
    const renderOverview = () => (
        <>
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
                        <Text className="text-xs text-muted">Priorität</Text>
                        <Text className="text-sm font-semibold" style={{ color: priorityConfig.color }}>
                            {priorityConfig.icon} {priorityConfig.label}
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

            {/* Notes */}
            {project.notes ? (
                <View className="bg-surface rounded-xl p-4 border border-border">
                    <Text className="text-sm font-bold text-foreground mb-1">Notizen</Text>
                    <Text className="text-sm text-muted">{project.notes}</Text>
                </View>
            ) : null}

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

            {/* Milestones */}
            <View>
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-base font-bold text-foreground">
                        Meilensteine
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
        </>
    );

    const renderTimeline = () => (
        <>
            {/* Add Note */}
            <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-2">Notiz hinzufügen</Text>
                <View className="flex-row gap-2">
                    <TextInput
                        value={newNote}
                        onChangeText={setNewNote}
                        placeholder="Was ist passiert?"
                        placeholderTextColor={colors.muted}
                        multiline
                        style={{
                            backgroundColor: colors.background,
                            color: colors.foreground,
                            borderColor: colors.border,
                            flex: 1,
                            minHeight: 40,
                            textAlignVertical: "top",
                        }}
                        className="p-3 rounded-lg border text-sm"
                    />
                    <TouchableOpacity
                        onPress={handleAddNote}
                        disabled={addingNote || !newNote.trim()}
                        style={{
                            backgroundColor: colors.primary,
                            opacity: addingNote || !newNote.trim() ? 0.5 : 1,
                        }}
                        className="w-12 rounded-lg items-center justify-center"
                    >
                        {addingNote ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <IconSymbol name="paperplane.fill" size={16} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Activities List */}
            {loadingActivities ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : activities.length === 0 ? (
                <View className="items-center py-12">
                    <Text className="text-muted text-sm">Noch keine Aktivitäten.</Text>
                </View>
            ) : (
                <View>
                    {activities.map((activity, index) => {
                        const icon = ACTIVITY_ICONS[activity.type] || "📌";
                        const isLast = index === activities.length - 1;

                        return (
                            <View key={activity.id} className="flex-row">
                                <View className="items-center" style={{ width: 40 }}>
                                    <View
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 14,
                                            backgroundColor: colors.primary + "15",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Text style={{ fontSize: 13 }}>{icon}</Text>
                                    </View>
                                    {!isLast && (
                                        <View
                                            style={{
                                                width: 2,
                                                flex: 1,
                                                backgroundColor: colors.border,
                                                minHeight: 20,
                                            }}
                                        />
                                    )}
                                </View>
                                <View className="flex-1 pb-4 ml-2">
                                    <View className="bg-surface rounded-lg p-3 border border-border">
                                        <Text className="text-sm text-foreground">{activity.description}</Text>
                                        <View className="flex-row justify-between mt-2">
                                            <Text className="text-xs text-muted">{activity.user_name}</Text>
                                            <Text className="text-xs text-muted">{formatDate(activity.created_at)}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </>
    );

    const renderTasks = () => {
        const openTasks = tasks.filter(t => t.status !== "done");
        const doneTasks = tasks.filter(t => t.status === "done");

        return (
            <>
                {/* Add Task */}
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-base font-bold text-foreground">
                        Aufgaben ({openTasks.length} offen)
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowTaskInput(!showTaskInput)}
                        style={{ backgroundColor: colors.primary + "20" }}
                        className="w-8 h-8 rounded-full items-center justify-center"
                    >
                        <IconSymbol
                            name={showTaskInput ? "xmark" : "plus"}
                            size={16}
                            color={colors.primary}
                        />
                    </TouchableOpacity>
                </View>

                {showTaskInput && (
                    <View className="flex-row gap-2 mb-4">
                        <TextInput
                            value={newTaskTitle}
                            onChangeText={setNewTaskTitle}
                            placeholder="Neue Aufgabe..."
                            placeholderTextColor={colors.muted}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                                flex: 1,
                            }}
                            className="p-3 rounded-lg border text-base"
                            onSubmitEditing={handleAddTask}
                        />
                        <TouchableOpacity
                            onPress={handleAddTask}
                            disabled={addingTask || !newTaskTitle.trim()}
                            style={{
                                backgroundColor: colors.primary,
                                opacity: addingTask || !newTaskTitle.trim() ? 0.5 : 1,
                            }}
                            className="w-12 rounded-lg items-center justify-center"
                        >
                            {addingTask ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <IconSymbol name="checkmark" size={18} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {loadingTasks ? (
                    <ActivityIndicator color={colors.primary} />
                ) : tasks.length === 0 ? (
                    <View className="items-center py-12">
                        <Text className="text-muted text-sm">Noch keine Aufgaben. Tippe + um eine hinzuzufügen.</Text>
                    </View>
                ) : (
                    <>
                        {/* Open Tasks */}
                        {openTasks.map((task) => {
                            const config = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.open;
                            return (
                                <TouchableOpacity
                                    key={task.id}
                                    className="bg-surface rounded-lg p-3 mb-2 border border-border flex-row items-center"
                                    onPress={() => handleToggleTask(task)}
                                    onLongPress={() => handleDeleteTask(task)}
                                    activeOpacity={0.7}
                                >
                                    <View
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            backgroundColor: config.color + "20",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginRight: 12,
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, color: config.color }}>{config.icon}</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-sm font-semibold text-foreground">{task.title}</Text>
                                        <View className="flex-row items-center gap-2 mt-1">
                                            <Text className="text-xs" style={{ color: config.color }}>{config.label}</Text>
                                            {task.due_date && (
                                                <Text className="text-xs text-muted">Fällig: {formatDate(task.due_date)}</Text>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Done Tasks */}
                        {doneTasks.length > 0 && (
                            <View className="mt-4">
                                <Text className="text-xs font-semibold text-muted uppercase mb-2">
                                    Erledigt ({doneTasks.length})
                                </Text>
                                {doneTasks.map((task) => (
                                    <TouchableOpacity
                                        key={task.id}
                                        className="bg-surface rounded-lg p-3 mb-2 border border-border flex-row items-center"
                                        style={{ opacity: 0.6 }}
                                        onPress={() => handleToggleTask(task)}
                                        onLongPress={() => handleDeleteTask(task)}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: 12,
                                                backgroundColor: "#10B98120",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginRight: 12,
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: "#10B981" }}>●</Text>
                                        </View>
                                        <Text
                                            className="text-sm text-muted flex-1"
                                            style={{ textDecorationLine: "line-through" }}
                                        >
                                            {task.title}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </>
        );
    };

    const renderDocuments = () => (
        <>
            {loadingDocs ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <>
                    {/* Linked Quotes */}
                    <View className="mb-4">
                        <Text className="text-base font-bold text-foreground mb-3">
                            Verknüpfte Angebote ({linkedQuotes.length})
                        </Text>
                        {linkedQuotes.length === 0 ? (
                            <Text className="text-sm text-muted">Keine verknüpften Angebote.</Text>
                        ) : (
                            linkedQuotes.map((quote) => (
                                <View
                                    key={quote.id}
                                    className="bg-surface rounded-lg p-3 mb-2 border border-border"
                                >
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-sm font-semibold text-foreground">
                                            {quote.quote_number}
                                        </Text>
                                        <View
                                            style={{
                                                backgroundColor: quote.status === "accepted" ? "#10B98120" : "#6B728020",
                                                paddingHorizontal: 8,
                                                paddingVertical: 2,
                                                borderRadius: 8,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: quote.status === "accepted" ? "#10B981" : "#6B7280",
                                                    fontSize: 11,
                                                    fontWeight: "600",
                                                }}
                                            >
                                                {quote.status === "accepted" ? "Angenommen" :
                                                    quote.status === "sent" ? "Gesendet" :
                                                        quote.status === "draft" ? "Entwurf" : quote.status}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text className="text-sm font-bold text-foreground mt-1">
                                        {formatCurrency(quote.total)}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>

                    {/* Linked Invoices */}
                    <View>
                        <Text className="text-base font-bold text-foreground mb-3">
                            Rechnungen ({linkedInvoices.length})
                        </Text>
                        {linkedInvoices.length === 0 ? (
                            <Text className="text-sm text-muted">Keine Rechnungen vorhanden.</Text>
                        ) : (
                            linkedInvoices.map((invoice) => {
                                const statusColors: any = {
                                    paid: "#10B981",
                                    open: "#3B82F6",
                                    overdue: "#EF4444",
                                    draft: "#6B7280",
                                    cancelled: "#9CA3AF",
                                };
                                const statusLabels: any = {
                                    paid: "Bezahlt",
                                    open: "Offen",
                                    overdue: "Überfällig",
                                    draft: "Entwurf",
                                    cancelled: "Storniert",
                                };
                                const sColor = statusColors[invoice.status] || "#6B7280";

                                return (
                                    <View
                                        key={invoice.id}
                                        className="bg-surface rounded-lg p-3 mb-2 border border-border"
                                    >
                                        <View className="flex-row justify-between items-center">
                                            <Text className="text-sm font-semibold text-foreground">
                                                {invoice.invoice_number}
                                            </Text>
                                            <View
                                                style={{
                                                    backgroundColor: sColor + "20",
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 2,
                                                    borderRadius: 8,
                                                }}
                                            >
                                                <Text style={{ color: sColor, fontSize: 11, fontWeight: "600" }}>
                                                    {statusLabels[invoice.status] || invoice.status}
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="flex-row justify-between mt-1">
                                            <Text className="text-xs text-muted">
                                                {formatDate(invoice.invoice_date)}
                                            </Text>
                                            <Text className="text-sm font-bold text-foreground">
                                                {formatCurrency(invoice.total)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                </>
            )}
        </>
    );

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

                    {/* Tabs */}
                    <View
                        className="flex-row border-b"
                        style={{ borderColor: colors.border }}
                    >
                        {tabs.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                className="flex-1 items-center py-3"
                                style={{
                                    borderBottomWidth: activeTab === tab.key ? 2 : 0,
                                    borderBottomColor: colors.primary,
                                }}
                            >
                                <IconSymbol
                                    name={tab.icon as any}
                                    size={18}
                                    color={activeTab === tab.key ? colors.primary : colors.muted}
                                />
                                <Text
                                    className="text-xs mt-1"
                                    style={{
                                        color: activeTab === tab.key ? colors.primary : colors.muted,
                                        fontWeight: activeTab === tab.key ? "700" : "500",
                                    }}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Tab Content */}
                    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
                        {activeTab === "overview" && renderOverview()}
                        {activeTab === "timeline" && renderTimeline()}
                        {activeTab === "tasks" && renderTasks()}
                        {activeTab === "documents" && renderDocuments()}
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
