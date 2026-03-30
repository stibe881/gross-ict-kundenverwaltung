import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    ActivityIndicator,
    Switch,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Data from "@/lib/data";
import { formatDate, formatCurrency } from "@/lib/format";
import { showAlert, showConfirm } from "@/lib/alert";
import { ProjectFormModal } from "./project-form-modal";

interface Props {
    visible: boolean;
    project: any;
    onClose: () => void;
    onUpdate: () => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    low: { label: "Niedrig", color: "#6B7280", icon: "arrow.down" },
    medium: { label: "Mittel", color: "#F59E0B", icon: "arrow.right" },
    high: { label: "Hoch", color: "#EF4444", icon: "arrow.up" },
    urgent: { label: "Dringend", color: "#DC2626", icon: "flame.fill" },
};

const STATUS_LABELS: Record<string, string> = {
    planning: "Planung",
    in_progress: "In Arbeit",
    completed: "Abgeschlossen",
    cancelled: "Abgebrochen",
};

const MILESTONE_ICONS: Record<string, string> = {
    pending: "clock",
    in_progress: "arrow.triangle.2.circlepath",
    completed: "checkmark.circle.fill",
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
    note: "note.text",
    status_change: "arrow.triangle.2.circlepath",
    milestone: "flag.checkered",
    task: "checkmark",
    system: "gearshape",
};

type TabKey = "overview" | "milestones" | "tasks" | "documents" | "verlauf";

export function ProjectDetailModal({ visible, project, onClose, onUpdate }: Props) {
    const colors = useColors();
    const [activeTab, setActiveTab] = useState<TabKey>("overview");
    const [showEditModal, setShowEditModal] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showPriorityPicker, setShowPriorityPicker] = useState(false);
    const [projectData, setProjectData] = useState<any>(project);

    // Keep projectData in sync with prop
    useEffect(() => {
        if (project) setProjectData(project);
    }, [project]);

    // Milestones
    const [milestones, setMilestones] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showMilestoneInput, setShowMilestoneInput] = useState(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
    const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("");
    const [addingMilestone, setAddingMilestone] = useState(false);

    // Edit Milestone State
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [editMilestoneTitle, setEditMilestoneTitle] = useState("");
    const [editMilestoneDueDate, setEditMilestoneDueDate] = useState("");
    const [savingMilestone, setSavingMilestone] = useState(false);

    // Milestone Notes State
    const [milestoneNotes, setMilestoneNotes] = useState<Record<string, any[]>>({});
    const [loadingNotes, setLoadingNotes] = useState<Record<string, boolean>>({});
    const [newNoteText, setNewNoteText] = useState("");
    const [newNoteIsPublic, setNewNoteIsPublic] = useState(false);
    const [addingMilestoneNote, setAddingMilestoneNote] = useState(false);
    const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);

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

    // Edit Task State
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [savingTask, setSavingTask] = useState(false);

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
            if (activeTab === "verlauf") loadActivities();
            if (activeTab === "tasks") loadTasks();
            if (activeTab === "documents") loadDocuments();
            if (activeTab === "milestones") loadMilestones();
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
            // Convert DD.MM.YYYY → YYYY-MM-DD for Supabase
            let formattedDueDate: string | null = null;
            if (newMilestoneDueDate.trim()) {
                const parts = newMilestoneDueDate.trim().split(".");
                if (parts.length === 3) {
                    formattedDueDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                } else {
                    formattedDueDate = newMilestoneDueDate; // pass through if already in other format
                }
            }
            await Data.createMilestone({
                project_id: project.id,
                title: newMilestoneTitle.trim(),
                status: "pending",
                sort_order: milestones.length,
                due_date: formattedDueDate,
            });
            setNewMilestoneTitle("");
            setNewMilestoneDueDate("");
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
        showConfirm(
            "Meilenstein löschen",
            `"${milestone.title}" wirklich löschen?`,
            async () => {
                await Data.deleteMilestone(milestone.id);
                await loadMilestones();
                onUpdate();
            },
            "Löschen"
        );
    };

    const handleStartEditMilestone = (milestone: any) => {
        setEditingMilestoneId(milestone.id);
        setEditMilestoneTitle(milestone.title);
        setEditMilestoneDueDate(milestone.due_date ? new Date(milestone.due_date).toLocaleDateString('de-CH') : "");
        // Also load notes for this milestone if not yet loaded
        if (!milestoneNotes[milestone.id]) {
            loadMilestoneNotes(milestone.id);
        }
    };

    const handleSaveMilestoneEdit = async () => {
        if (!editMilestoneTitle.trim() || !editingMilestoneId) return;
        setSavingMilestone(true);
        try {
            let formattedDate = editMilestoneDueDate;
            if (formattedDate && formattedDate.includes('.')) {
                const parts = formattedDate.split('.');
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            await Data.updateMilestone(editingMilestoneId, {
                title: editMilestoneTitle.trim(),
                due_date: formattedDate || null,
            });
            setEditingMilestoneId(null);
            setNewNoteText("");
            setNewNoteIsPublic(false);
            await loadMilestones();
            onUpdate();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setSavingMilestone(false);
        }
    };

    const loadMilestoneNotes = async (milestoneId: string) => {
        setLoadingNotes(prev => ({ ...prev, [milestoneId]: true }));
        try {
            const notes = await Data.getMilestoneNotes(milestoneId);
            setMilestoneNotes(prev => ({ ...prev, [milestoneId]: notes }));
        } catch (e) {
            console.error("Failed to load milestone notes:", e);
        } finally {
            setLoadingNotes(prev => ({ ...prev, [milestoneId]: false }));
        }
    };

    const handleAddMilestoneNote = async (milestoneId: string) => {
        if (!newNoteText.trim()) return;
        setAddingMilestoneNote(true);
        try {
            await Data.addMilestoneNote(milestoneId, newNoteText.trim(), newNoteIsPublic);
            setNewNoteText("");
            setNewNoteIsPublic(false);
            await loadMilestoneNotes(milestoneId);
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setAddingMilestoneNote(false);
        }
    };

    const handleToggleNoteVisibility = async (milestoneId: string, note: any) => {
        try {
            await Data.updateMilestoneNote(note.id, { is_public: !note.is_public });
            await loadMilestoneNotes(milestoneId);
        } catch (error: any) {
            showAlert("Fehler", error.message);
        }
    };

    const handleDeleteMilestoneNote = (milestoneId: string, note: any) => {
        showConfirm(
            "Notiz löschen",
            "Diese Notiz wirklich löschen?",
            async () => {
                await Data.deleteMilestoneNote(note.id);
                await loadMilestoneNotes(milestoneId);
            },
            "Löschen"
        );
    };

    const handleExpandMilestone = (milestoneId: string) => {
        if (expandedMilestoneId === milestoneId) {
            setExpandedMilestoneId(null);
        } else {
            setExpandedMilestoneId(milestoneId);
            if (!milestoneNotes[milestoneId]) {
                loadMilestoneNotes(milestoneId);
            }
        }
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

    const handleStartEditTask = (task: any) => {
        setEditingTaskId(task.id);
        setEditTaskTitle(task.title);
    };

    const handleSaveTaskEdit = async () => {
        if (!editTaskTitle.trim() || !editingTaskId) return;
        setSavingTask(true);
        try {
            await Data.updateProjectTask(editingTaskId, { title: editTaskTitle.trim() });
            setEditingTaskId(null);
            await loadTasks();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setSavingTask(false);
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
        showConfirm(
            "Aufgabe löschen",
            `"${task.title}" wirklich löschen?`,
            async () => {
                await Data.deleteProjectTask(task.id);
                await loadTasks();
            },
            "Löschen"
        );
    };

    // ---- Computed ----
    const completedCount = milestones.filter((m) => m.status === "completed").length;
    const progressPercent = milestones.length > 0
        ? Math.round((completedCount / milestones.length) * 100)
        : 0;

    const priorityConfig = PRIORITY_CONFIG[projectData?.priority] || PRIORITY_CONFIG.medium;

    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: "overview", label: "Übersicht", icon: "info.circle" },
        { key: "milestones", label: "Timeline", icon: "flag" },
        { key: "tasks", label: "Aufgaben", icon: "checklist" },
        { key: "documents", label: "Dokumente", icon: "doc.text" },
        { key: "verlauf", label: "Verlauf", icon: "clock" },
    ];

    // ---- Render Sections ----
    const renderOverview = () => {
        const customerName = project.customer?.company_name ||
            `${project.customer?.first_name || ""} ${project.customer?.last_name || ""}`.trim() || "—";
        const customerEmail = project.customer?.email;
        const customerPhone = project.customer?.phone;
        const statusColor = projectData.status === "completed" ? "#10B981" :
            projectData.status === "in_progress" ? "#3B82F6" :
                projectData.status === "cancelled" ? "#EF4444" : "#6B7280";

        const InfoRow = ({ label, value, icon }: { label: string; value?: string | null; icon: string }) => {
            if (!value) return null;
            return (
                <View className="flex-row items-start py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: colors.border + "40" }}>
                    <View style={{ width: 32, alignItems: "center", paddingTop: 2 }}>
                        <IconSymbol name={icon as any} size={14} color={colors.muted} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-muted mb-0.5">{label}</Text>
                        <Text className="text-sm font-medium text-foreground">{value}</Text>
                    </View>
                </View>
            );
        };

        return (
            <>
                {/* Titel & Beschreibung */}
                <View className="bg-surface rounded-xl p-5 border border-border">
                    <Text className="text-xl font-bold text-foreground">{projectData.title}</Text>
                    {projectData.description ? (
                        <Text className="text-sm text-muted mt-2 leading-5">{projectData.description}</Text>
                    ) : null}

                    {/* Status & Priorität als Badges */}
                    <View className="flex-row gap-2 mt-4">
                        <TouchableOpacity
                            onPress={() => setShowStatusPicker(!showStatusPicker)}
                            style={{ backgroundColor: statusColor + "15", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                        >
                            <Text style={{ color: statusColor, fontSize: 13, fontWeight: "600" }}>
                                {STATUS_LABELS[projectData.status] || projectData.status} ▾
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowPriorityPicker(!showPriorityPicker)}
                            style={{ backgroundColor: priorityConfig.color + "15", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                        >
                            <Text style={{ color: priorityConfig.color, fontSize: 13, fontWeight: "600" }}>
                                {priorityConfig.label} ▾
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Status Picker Dropdown */}
                    {showStatusPicker && (
                        <View style={{
                            backgroundColor: colors.surface, borderRadius: 12,
                            borderWidth: 1, borderColor: colors.border,
                            marginTop: 8, overflow: "hidden",
                            shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
                        }}>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={async () => {
                                        setShowStatusPicker(false);
                                        try {
                                            await Data.updateProject(projectData.id, { status: key });
                                            await Data.addProjectActivity(projectData.id, "status_change", `Status geändert: ${STATUS_LABELS[key]}`);
                                            setProjectData({ ...projectData, status: key });
                                            onUpdate();
                                        } catch (e: any) { showAlert("Fehler", e.message); }
                                    }}
                                    style={{
                                        padding: 12, paddingHorizontal: 16,
                                        backgroundColor: projectData.status === key ? colors.primary + "15" : "transparent",
                                    }}
                                >
                                    <Text style={{
                                        color: projectData.status === key ? colors.primary : colors.foreground,
                                        fontWeight: projectData.status === key ? "700" : "400",
                                        fontSize: 14,
                                    }}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Priority Picker Dropdown */}
                    {showPriorityPicker && (
                        <View style={{
                            backgroundColor: colors.surface, borderRadius: 12,
                            borderWidth: 1, borderColor: colors.border,
                            marginTop: 8, overflow: "hidden",
                            shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
                        }}>
                            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={async () => {
                                        setShowPriorityPicker(false);
                                        try {
                                            await Data.updateProject(projectData.id, { priority: key });
                                            setProjectData({ ...projectData, priority: key });
                                            onUpdate();
                                        } catch (e: any) { showAlert("Fehler", e.message); }
                                    }}
                                    style={{
                                        padding: 12, paddingHorizontal: 16,
                                        backgroundColor: projectData.priority === key ? cfg.color + "15" : "transparent",
                                    }}
                                >
                                    <Text style={{
                                        color: projectData.priority === key ? cfg.color : colors.foreground,
                                        fontWeight: projectData.priority === key ? "700" : "400",
                                        fontSize: 14,
                                    }}>{cfg.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Projektdaten */}
                <View className="bg-surface rounded-xl p-5 border border-border">
                    <Text className="text-base font-bold text-foreground mb-2">
                        <IconSymbol name="folder" size={15} color={colors.foreground} />  Projektdaten
                    </Text>
                    <InfoRow label="Kunde" value={customerName} icon="person" />
                    {project.customer?.company_name && (
                        <InfoRow label="Kontakt" value={`${project.customer?.first_name || ""} ${project.customer?.last_name || ""}`.trim() || undefined} icon="person.2" />
                    )}
                    <InfoRow label="E-Mail" value={customerEmail} icon="envelope" />
                    <InfoRow label="Telefon" value={customerPhone} icon="phone" />
                    <InfoRow label="Budget" value={project.budget > 0 ? formatCurrency(project.budget) : undefined} icon="banknote" />
                    <InfoRow
                        label="Zeitraum"
                        value={project.start_date ? `${formatDate(project.start_date)}${project.end_date ? ` – ${formatDate(project.end_date)}` : ""}` : undefined}
                        icon="calendar"
                    />
                </View>

                {/* Notizen */}
                {project.notes ? (
                    <View className="bg-surface rounded-xl p-5 border border-border">
                        <Text className="text-base font-bold text-foreground mb-2">
                            <IconSymbol name="note.text" size={15} color={colors.foreground} />  Notizen
                        </Text>
                        <Text className="text-sm text-muted leading-5">{project.notes}</Text>
                    </View>
                ) : null}

                {/* Fortschritt */}
                {milestones.length > 0 && (
                    <View className="bg-surface rounded-xl p-5 border border-border">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-base font-bold text-foreground">
                                <IconSymbol name="chart.bar" size={15} color={colors.foreground} />  Fortschritt
                            </Text>
                            <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                                {progressPercent}%
                            </Text>
                        </View>
                        <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4 }}>
                            <View
                                style={{
                                    height: 8,
                                    width: `${progressPercent}%`,
                                    backgroundColor: progressPercent === 100 ? "#10B981" : colors.primary,
                                    borderRadius: 4,
                                }}
                            />
                        </View>
                        <Text className="text-xs text-muted mt-2">
                            {completedCount} von {milestones.length} Meilensteinen abgeschlossen
                        </Text>

                        {/* Quick milestone overview */}
                        <View className="mt-3 gap-1.5">
                            {milestones.slice(0, 5).map((m: any) => (
                                <View key={m.id} className="flex-row items-center gap-2">
                                    <IconSymbol
                                        name={(MILESTONE_ICONS[m.status] || "clock") as any}
                                        size={12}
                                        color={MILESTONE_COLORS[m.status] || "#6B7280"}
                                    />
                                    <Text
                                        className="text-xs flex-1"
                                        style={{
                                            color: m.status === "completed" ? colors.muted : colors.foreground,
                                            textDecorationLine: m.status === "completed" ? "line-through" : "none",
                                        }}
                                        numberOfLines={1}
                                    >
                                        {m.title}
                                    </Text>
                                </View>
                            ))}
                            {milestones.length > 5 && (
                                <Text className="text-xs text-muted mt-1">
                                    + {milestones.length - 5} weitere Meilensteine
                                </Text>
                            )}
                        </View>
                    </View>
                )}
            </>
        );
    };

    const renderMilestones = () => (
        <>
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
                    <View className="mb-4 gap-2">
                        <View className="flex-row gap-2">
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
                        <TextInput
                            value={newMilestoneDueDate}
                            onChangeText={setNewMilestoneDueDate}
                            placeholder="Fällig am (DD.MM.YYYY)"
                            placeholderTextColor={colors.muted}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                            }}
                            className="p-3 rounded-lg border text-sm"
                        />
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
                            const icon = MILESTONE_ICONS[milestone.status] || "clock";
                            const isEditing = editingMilestoneId === milestone.id;

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
                                            <IconSymbol name={icon as any} size={14} color={statusColor} />
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

                                    {isEditing ? (
                                        <View className="flex-1 pb-4 ml-2">
                                            <View
                                                className="bg-surface rounded-lg p-4 border"
                                                style={{ borderColor: colors.primary }}
                                            >
                                                <Text className="text-sm font-bold text-foreground mb-3">Meilenstein bearbeiten</Text>

                                                <TextInput
                                                    value={editMilestoneTitle}
                                                    onChangeText={setEditMilestoneTitle}
                                                    placeholder="Titel..."
                                                    placeholderTextColor={colors.muted}
                                                    style={{ backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }}
                                                    className="p-3 rounded-lg border text-sm mb-3"
                                                />

                                                <TextInput
                                                    value={editMilestoneDueDate}
                                                    onChangeText={setEditMilestoneDueDate}
                                                    placeholder="Fällig am (DD.MM.YYYY)"
                                                    placeholderTextColor={colors.muted}
                                                    style={{ backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }}
                                                    className="p-3 rounded-lg border text-sm mb-3"
                                                />

                                                {/* Notes managed separately below */}


                                                <View style={{ flexDirection: "row", gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => setEditingMilestoneId(null)}
                                                        style={{ flex: 1, borderColor: colors.border, borderWidth: 1 }}
                                                        className="px-4 py-2 rounded-lg items-center"
                                                    >
                                                        <Text style={{ color: colors.foreground }} className="text-sm font-semibold">Abbrechen</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={handleSaveMilestoneEdit}
                                                        disabled={savingMilestone || !editMilestoneTitle.trim()}
                                                        style={{
                                                            flex: 1,
                                                            backgroundColor: colors.primary,
                                                            opacity: savingMilestone || !editMilestoneTitle.trim() ? 0.5 : 1,
                                                        }}
                                                        className="px-4 py-2 rounded-lg items-center"
                                                    >
                                                        {savingMilestone ? (
                                                            <ActivityIndicator size="small" color="#fff" />
                                                        ) : (
                                                            <Text className="text-sm font-semibold text-white">Speichern</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Notes section inside edit form */}
                                                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Notizen</Text>
                                                    {loadingNotes[milestone.id] ? (
                                                        <ActivityIndicator color={colors.primary} size="small" />
                                                    ) : (
                                                        (milestoneNotes[milestone.id] || []).map((note: any) => (
                                                            <View key={note.id} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                                                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                                    <Text style={{ fontSize: 13, color: colors.foreground, flex: 1, lineHeight: 18 }}>{note.text}</Text>
                                                                    <TouchableOpacity onPress={() => handleDeleteMilestoneNote(milestone.id, note)} style={{ paddingLeft: 8 }}>
                                                                        <IconSymbol name="trash" size={13} color={colors.muted} />
                                                                    </TouchableOpacity>
                                                                </View>
                                                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                                                                    <Text style={{ fontSize: 10, color: colors.muted }}>{note.created_by}</Text>
                                                                    <TouchableOpacity
                                                                        onPress={() => handleToggleNoteVisibility(milestone.id, note)}
                                                                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: note.is_public ? colors.primary + "20" : colors.border + "60" }}
                                                                    >
                                                                        <Text style={{ fontSize: 10, color: note.is_public ? colors.primary : colors.muted, fontWeight: "600" }}>
                                                                            {note.is_public ? "👁️ Öffentlich" : "🔒 Intern"}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        ))
                                                    )}

                                                    {/* Add note input */}
                                                    <TextInput
                                                        value={newNoteText}
                                                        onChangeText={setNewNoteText}
                                                        placeholder="Neue Notiz..."
                                                        placeholderTextColor={colors.muted}
                                                        multiline
                                                        style={{ backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, minHeight: 50, textAlignVertical: "top" }}
                                                        className="p-3 rounded-lg border text-sm mt-1 mb-2"
                                                    />
                                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                                            <Switch
                                                                value={newNoteIsPublic}
                                                                onValueChange={setNewNoteIsPublic}
                                                                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                                                                thumbColor={newNoteIsPublic ? colors.primary : "#f4f3f4"}
                                                            />
                                                            <Text style={{ fontSize: 12, color: colors.muted }}>{newNoteIsPublic ? "Für Kunden sichtbar" : "Nur intern"}</Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            onPress={() => handleAddMilestoneNote(milestone.id)}
                                                            disabled={addingMilestoneNote || !newNoteText.trim()}
                                                            style={{ backgroundColor: colors.primary, opacity: addingMilestoneNote || !newNoteText.trim() ? 0.5 : 1, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 }}
                                                        >
                                                            {addingMilestoneNote ? (
                                                                <ActivityIndicator size="small" color="#fff" />
                                                            ) : (
                                                                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>+ Hinzufügen</Text>
                                                            )}
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                            </View>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            className="flex-1 pb-4 ml-2"
                                            onPress={() => handleToggleMilestone(milestone)}
                                            activeOpacity={0.7}
                                        >
                                            <View className="bg-surface rounded-lg p-3 border border-border">
                                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                    <View style={{ flex: 1 }}>
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
                                                    </View>
                                                    <View style={{ flexDirection: "row", gap: 12, paddingLeft: 8 }}>
                                                        <TouchableOpacity onPress={() => handleStartEditMilestone(milestone)}>
                                                            <IconSymbol name="pencil" size={14} color={colors.muted} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => handleDeleteMilestone(milestone)}>
                                                            <IconSymbol name="trash" size={14} color={colors.muted} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                {milestone.notes ? (
                                                    <View
                                                        style={{ marginTop: 10, padding: 10, backgroundColor: colors.background, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                                                    >
                                                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                                                            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>Notizen</Text>
                                                            <Text style={{ fontSize: 10, color: milestone.is_note_public ? colors.primary : colors.muted }}>
                                                                {milestone.is_note_public ? "👁️ Öffentlich" : "🔒 Intern"}
                                                            </Text>
                                                        </View>
                                                        <Text style={{ fontSize: 13, color: colors.foreground }}>{milestone.notes}</Text>
                                                    </View>
                                                ) : null}

                                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                                                    <Text style={{ fontSize: 11, fontWeight: "500", color: statusColor }}>
                                                        {milestone.status === "completed" ? "Abgeschlossen" :
                                                            milestone.status === "in_progress" ? "In Arbeit" : "Ausstehend"}
                                                    </Text>
                                                    {milestone.due_date && (
                                                        <Text style={{ fontSize: 11, fontWeight: "500", color: colors.muted }}>
                                                            {formatDate(milestone.due_date)}
                                                        </Text>
                                                    )}
                                                </View>

                                                {/* Notes preview — tap to expand */}
                                                <TouchableOpacity
                                                    onPress={() => handleExpandMilestone(milestone.id)}
                                                    style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
                                                >
                                                    <IconSymbol name="note.text" size={12} color={colors.muted} />
                                                    <Text style={{ fontSize: 11, color: colors.muted }}>
                                                        {expandedMilestoneId === milestone.id ? "Notizen verbergen" : `Notizen ${milestoneNotes[milestone.id]?.length ? `(${milestoneNotes[milestone.id].length})` : "anzeigen"}`}
                                                    </Text>
                                                </TouchableOpacity>

                                                {expandedMilestoneId === milestone.id && (
                                                    <View style={{ marginTop: 8 }}>
                                                        {loadingNotes[milestone.id] ? (
                                                            <ActivityIndicator size="small" color={colors.primary} />
                                                        ) : (milestoneNotes[milestone.id] || []).length === 0 ? (
                                                            <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>Noch keine Notizen. Bearbeite den Meilenstein zum Hinzufügen.</Text>
                                                        ) : (
                                                            (milestoneNotes[milestone.id] || []).map((note: any) => (
                                                                <View key={note.id} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border }}>
                                                                    <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 18 }}>{note.text}</Text>
                                                                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                                                                        <Text style={{ fontSize: 10, color: colors.muted }}>{note.created_by}</Text>
                                                                        <Text style={{ fontSize: 10, color: note.is_public ? colors.primary : colors.muted, fontWeight: "600" }}>
                                                                            {note.is_public ? "👁️ Öffentlich" : "🔒 Intern"}
                                                                        </Text>
                                                                    </View>
                                                                </View>
                                                            ))
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        </>
    );

    const renderVerlauf = () => (
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
                        const iconName = ACTIVITY_ICONS[activity.type] || "pin";
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
                                        <IconSymbol name={iconName as any} size={13} color={colors.primary} />
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
                            const isEditing = editingTaskId === task.id;

                            if (isEditing) {
                                return (
                                    <View key={task.id} className="bg-surface rounded-lg p-3 mb-2 border" style={{ borderColor: colors.primary }}>
                                        <TextInput
                                            value={editTaskTitle}
                                            onChangeText={setEditTaskTitle}
                                            placeholder="Aufgabentitel..."
                                            placeholderTextColor={colors.muted}
                                            autoFocus
                                            style={{ color: colors.foreground, fontSize: 14, marginBottom: 10 }}
                                            onSubmitEditing={handleSaveTaskEdit}
                                        />
                                        <View style={{ flexDirection: "row", gap: 8 }}>
                                            <TouchableOpacity
                                                onPress={() => setEditingTaskId(null)}
                                                style={{ flex: 1, borderColor: colors.border, borderWidth: 1, paddingVertical: 6, borderRadius: 8, alignItems: "center" }}
                                            >
                                                <Text style={{ color: colors.muted, fontSize: 13 }}>Abbrechen</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={handleSaveTaskEdit}
                                                disabled={savingTask || !editTaskTitle.trim()}
                                                style={{ flex: 1, backgroundColor: colors.primary, opacity: savingTask || !editTaskTitle.trim() ? 0.5 : 1, paddingVertical: 6, borderRadius: 8, alignItems: "center" }}
                                            >
                                                {savingTask ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Speichern</Text>}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            }

                            return (
                                <View key={task.id} className="bg-surface rounded-lg p-3 mb-2 border border-border flex-row items-center">
                                    <TouchableOpacity onPress={() => handleToggleTask(task)} style={{ marginRight: 12 }}>
                                        <View
                                            style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: 12,
                                                backgroundColor: config.color + "20",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: config.color }}>{config.icon}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                        <Text className="text-sm font-semibold text-foreground">{task.title}</Text>
                                        <View className="flex-row items-center gap-2 mt-1">
                                            <Text className="text-xs" style={{ color: config.color }}>{config.label}</Text>
                                            {task.due_date && (
                                                <Text className="text-xs text-muted">Fällig: {formatDate(task.due_date)}</Text>
                                            )}
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: "row", gap: 14, paddingLeft: 8 }}>
                                        <TouchableOpacity onPress={() => handleStartEditTask(task)}>
                                            <IconSymbol name="pencil" size={14} color={colors.muted} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDeleteTask(task)}>
                                            <IconSymbol name="trash" size={14} color={colors.muted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}

                        {/* Done Tasks */}
                        {doneTasks.length > 0 && (
                            <View className="mt-4">
                                <Text className="text-xs font-semibold text-muted uppercase mb-2">
                                    Erledigt ({doneTasks.length})
                                </Text>
                                {doneTasks.map((task) => (
                                    <View key={task.id} className="bg-surface rounded-lg p-3 mb-2 border border-border flex-row items-center" style={{ opacity: 0.65 }}>
                                        <TouchableOpacity onPress={() => handleToggleTask(task)} style={{ marginRight: 12 }}>
                                            <View
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 12,
                                                    backgroundColor: "#10B98120",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <Text style={{ fontSize: 12, color: "#10B981" }}>●</Text>
                                            </View>
                                        </TouchableOpacity>
                                        <Text className="text-sm text-muted flex-1" style={{ textDecorationLine: "line-through" }}>{task.title}</Text>
                                        <TouchableOpacity onPress={() => handleDeleteTask(task)} style={{ paddingLeft: 8 }}>
                                            <IconSymbol name="trash" size={14} color={colors.muted} />
                                        </TouchableOpacity>
                                    </View>
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
                        <TouchableOpacity onPress={() => {
                            showConfirm(
                                "Projekt löschen",
                                `Möchten Sie "${project.title}" wirklich löschen?`,
                                async () => {
                                    await Data.deleteProject(project.id);
                                    onUpdate();
                                    onClose();
                                },
                                "Löschen"
                            );
                        }}>
                            <IconSymbol name="trash" size={20} color={colors.error || "#EF4444"} />
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
                        {activeTab === "milestones" && renderMilestones()}
                        {activeTab === "tasks" && renderTasks()}
                        {activeTab === "documents" && renderDocuments()}
                        {activeTab === "verlauf" && renderVerlauf()}
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
