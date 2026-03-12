import { useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatDate } from "@/lib/format";
import { showConfirm, showAlert } from "@/lib/alert";
import { ProjectFormModal } from "@/components/project-form-modal";
import { ProjectDetailModal } from "@/components/project-detail-modal";

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
    planning: { label: "Planung", color: "#8B5CF6", dotColor: "#8B5CF6" },
    in_progress: { label: "Aktiv", color: "#3B82F6", dotColor: "#3B82F6" },
    on_hold: { label: "Pausiert", color: "#F59E0B", dotColor: "#F59E0B" },
    completed: { label: "Abgeschlossen", color: "#10B981", dotColor: "#10B981" },
    cancelled: { label: "Abgebrochen", color: "#EF4444", dotColor: "#EF4444" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    low: { label: "NIEDRIG", color: "#6B7280" },
    medium: { label: "MITTEL", color: "#F59E0B" },
    high: { label: "HOCH", color: "#EF4444" },
    urgent: { label: "DRINGEND", color: "#DC2626" },
};

const KANBAN_COLUMNS: { key: string; label: string }[] = [
    { key: "planning", label: "Planung" },
    { key: "in_progress", label: "Aktiv" },
    { key: "on_hold", label: "Pausiert" },
    { key: "completed", label: "Abgeschlossen" },
];

type ViewMode = "kanban" | "list";

export default function ProjectsScreen() {
    const colors = useColors();
    const { containerStyle, contentPadding, isWide } = useResponsiveLayout();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("kanban");
    const [search, setSearch] = useState("");

    const {
        data: projects,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["projects"],
        queryFn: Data.getAllProjects,
    });

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [])
    );

    // ── Derived data ──
    const allProjects = projects || [];

    const filteredProjects = useMemo(() => {
        if (!search.trim()) return allProjects;
        const q = search.toLowerCase();
        return allProjects.filter((p: any) =>
            p.title?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.project_number?.toLowerCase().includes(q) ||
            p.customer?.company_name?.toLowerCase().includes(q)
        );
    }, [allProjects, search]);

    const activeCount = allProjects.filter((p: any) => p.status === "in_progress").length;
    const planningCount = allProjects.filter((p: any) => p.status === "planning").length;
    const overdueCount = allProjects.filter((p: any) => {
        if (p.status === "completed" || p.status === "cancelled") return false;
        if (!p.end_date) return false;
        return new Date(p.end_date) < new Date();
    }).length;

    const projectsByColumn = useMemo(() => {
        const map: Record<string, any[]> = {};
        KANBAN_COLUMNS.forEach(col => { map[col.key] = []; });
        filteredProjects.forEach((p: any) => {
            const key = map[p.status] ? p.status : "planning";
            map[key].push(p);
        });
        return map;
    }, [filteredProjects]);

    // ── Handlers ──
    const openProject = (project: any) => {
        setSelectedProject(project);
        setShowDetailModal(true);
    };

    const handleDelete = (project: any) => {
        showConfirm(
            "Projekt löschen",
            `"${project.title}" wirklich löschen?`,
            async () => {
                await Data.deleteProject(project.id);
                queryClient.invalidateQueries({ queryKey: ["projects"] });
            },
            "Löschen"
        );
    };

    const getCustomerName = (project: any) =>
        project.customer?.company_name ||
        `${project.customer?.first_name || ""} ${project.customer?.last_name || ""}`.trim() ||
        "—";

    const getMilestoneCount = (project: any) => {
        const ms = project.milestones || [];
        return ms.length;
    };

    // ── Project Card (shared between Kanban + List) ──
    const renderProjectCard = (project: any, isListMode = false) => {
        const statusConf = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning;
        const prioConf = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.medium;

        return (
            <TouchableOpacity
                key={project.id}
                className="bg-surface rounded-xl p-4 border border-border"
                style={isListMode ? { marginBottom: 12 } : { marginBottom: 8 }}
                activeOpacity={0.7}
                onPress={() => openProject(project)}
                onLongPress={() => handleDelete(project)}
            >
                {/* Priority + Status badges */}
                <View className="flex-row items-center gap-2 mb-2">
                    <View className="px-2 py-0.5 rounded" style={{ backgroundColor: prioConf.color + "20" }}>
                        <Text className="text-[10px] font-bold" style={{ color: prioConf.color }}>
                            {prioConf.label}
                        </Text>
                    </View>
                    <View className="px-2 py-0.5 rounded" style={{ backgroundColor: statusConf.color + "20" }}>
                        <Text className="text-[10px] font-bold" style={{ color: statusConf.color }}>
                            {statusConf.label}
                        </Text>
                    </View>
                    <View className="flex-1" />
                    <IconSymbol name="chevron.down" size={14} color={colors.muted} />
                </View>

                {/* Title */}
                <Text className="text-sm font-bold text-foreground mb-1" numberOfLines={1}>
                    {project.title}
                </Text>

                {/* Description */}
                {project.description && (
                    <Text className="text-xs text-muted mb-2" numberOfLines={2}>
                        {project.description}
                    </Text>
                )}

                {/* Footer: Customer, Date, Comments */}
                <View className="flex-row items-center gap-3 flex-wrap">
                    <View className="flex-row items-center gap-1">
                        <IconSymbol name="person.fill" size={10} color={colors.muted} />
                        <Text className="text-[10px] text-muted" numberOfLines={1}>
                            {getCustomerName(project)}
                        </Text>
                    </View>
                    {project.end_date && (
                        <View className="flex-row items-center gap-1">
                            <IconSymbol name="calendar" size={10} color={colors.muted} />
                            <Text className="text-[10px] text-muted">{formatDate(project.end_date)}</Text>
                        </View>
                    )}
                    {getMilestoneCount(project) > 0 && (
                        <View className="flex-row items-center gap-1">
                            <IconSymbol name="flag.fill" size={10} color={colors.warning} />
                            <Text className="text-[10px] text-muted">{getMilestoneCount(project)}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // ── Kanban Column ──
    const renderKanbanColumn = (column: { key: string; label: string }) => {
        const items = projectsByColumn[column.key] || [];
        const conf = STATUS_CONFIG[column.key] || STATUS_CONFIG.planning;

        return (
            <View
                key={column.key}
                className="bg-background rounded-xl border border-border"
                style={{
                    flex: isWide ? 1 : undefined,
                }}
            >
                {/* Column Header */}
                <View className="flex-row items-center gap-2 px-4 py-3 border-b border-border">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: conf.dotColor }} />
                    <Text className="text-sm font-semibold text-foreground">{column.label}</Text>
                    <View
                        className="px-1.5 py-0.5 rounded-full min-w-[20px] items-center"
                        style={{ backgroundColor: conf.color + "15" }}
                    >
                        <Text className="text-[10px] font-bold" style={{ color: conf.color }}>
                            {items.length}
                        </Text>
                    </View>
                </View>

                {/* Column Content */}
                {isWide ? (
                    <ScrollView className="p-2" style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                        {items.length === 0 ? (
                            <View className="items-center py-6">
                                <Text className="text-xs text-muted">Leer</Text>
                            </View>
                        ) : (
                            items.map((project: any) => renderProjectCard(project))
                        )}
                    </ScrollView>
                ) : (
                    <View className="p-2">
                        {items.length === 0 ? (
                            <View className="items-center py-4">
                                <Text className="text-xs text-muted">Leer</Text>
                            </View>
                        ) : (
                            items.map((project: any) => renderProjectCard(project))
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <ScreenContainer>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
            >
                <View style={{ padding: contentPadding }}>
                    <View style={containerStyle}>
                        {/* ── Header ── */}
                        <View className="mb-4">
                            {/* Row 1: Back + Title */}
                            <View className="flex-row items-center justify-between mb-3">
                                <View className="flex-row items-center gap-3">
                                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                                        <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                                    </TouchableOpacity>
                                    <View>
                                        <Text className="text-2xl font-bold text-foreground">Projekte</Text>
                                        {isWide && <Text className="text-sm text-muted">Projekte verwalten und Fortschritte verfolgen.</Text>}
                                    </View>
                                </View>

                                {/* Desktop: search inline */}
                                {isWide && (
                                    <View className="flex-row items-center gap-2">
                                        <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-1.5 gap-2" style={{ width: 180 }}>
                                            <IconSymbol name="magnifyingglass" size={14} color={colors.muted} />
                                            <TextInput
                                                className="flex-1 text-foreground text-sm"
                                                placeholder="Suchen..."
                                                placeholderTextColor={colors.muted}
                                                value={search}
                                                onChangeText={setSearch}
                                            />
                                        </View>
                                        <View className="flex-row bg-surface border border-border rounded-lg overflow-hidden">
                                            <TouchableOpacity
                                                className="flex-row items-center gap-1 px-3 py-1.5"
                                                style={{ backgroundColor: viewMode === "kanban" ? colors.primary : "transparent" }}
                                                onPress={() => setViewMode("kanban")}
                                                activeOpacity={0.8}
                                            >
                                                <IconSymbol name="square.grid.2x2.fill" size={12} color={viewMode === "kanban" ? "#111" : colors.muted} />
                                                <Text className="text-xs font-semibold" style={{ color: viewMode === "kanban" ? "#111" : colors.foreground }}>Kanban</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="flex-row items-center gap-1 px-3 py-1.5"
                                                style={{ backgroundColor: viewMode === "list" ? colors.primary : "transparent" }}
                                                onPress={() => setViewMode("list")}
                                                activeOpacity={0.8}
                                            >
                                                <IconSymbol name="list.bullet" size={12} color={viewMode === "list" ? "#111" : colors.muted} />
                                                <Text className="text-xs font-semibold" style={{ color: viewMode === "list" ? "#111" : colors.foreground }}>Liste</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity
                                            className="flex-row items-center gap-1.5 bg-primary px-4 py-2 rounded-lg"
                                            onPress={() => setShowCreateModal(true)}
                                            activeOpacity={0.8}
                                        >
                                            <Text className="text-sm font-semibold" style={{ color: "#111" }}>+ Neues Projekt</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Row 2 (mobile only): Controls */}
                            {!isWide && (
                                <View className="flex-row items-center gap-2">
                                    <View className="flex-row bg-surface border border-border rounded-lg overflow-hidden">
                                        <TouchableOpacity
                                            className="flex-row items-center gap-1 px-3 py-2"
                                            style={{ backgroundColor: viewMode === "kanban" ? colors.primary : "transparent" }}
                                            onPress={() => setViewMode("kanban")}
                                            activeOpacity={0.8}
                                        >
                                            <IconSymbol name="square.grid.2x2.fill" size={14} color={viewMode === "kanban" ? "#111" : colors.muted} />
                                            <Text className="text-xs font-semibold" style={{ color: viewMode === "kanban" ? "#111" : colors.foreground }}>Kanban</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className="flex-row items-center gap-1 px-3 py-2"
                                            style={{ backgroundColor: viewMode === "list" ? colors.primary : "transparent" }}
                                            onPress={() => setViewMode("list")}
                                            activeOpacity={0.8}
                                        >
                                            <IconSymbol name="list.bullet" size={14} color={viewMode === "list" ? "#111" : colors.muted} />
                                            <Text className="text-xs font-semibold" style={{ color: viewMode === "list" ? "#111" : colors.foreground }}>Liste</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-1" />
                                    <TouchableOpacity
                                        className="flex-row items-center gap-1.5 bg-primary px-4 py-2 rounded-lg"
                                        onPress={() => setShowCreateModal(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Text className="text-sm font-semibold" style={{ color: "#111" }}>+ Neues Projekt</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* ── Mobile Search ── */}
                        {!isWide && (
                            <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2 gap-2 mb-3">
                                <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                                <TextInput
                                    className="flex-1 text-foreground text-sm"
                                    placeholder="Projekt suchen..."
                                    placeholderTextColor={colors.muted}
                                    value={search}
                                    onChangeText={setSearch}
                                />
                                {search.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearch("")}>
                                        <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* ── Stats Cards ── */}
                        <View className="flex-row gap-3 mb-4">
                            <View className="flex-1 bg-surface rounded-lg border-l-4 p-3" style={{ borderColor: "#3B82F6", borderWidth: 1, borderLeftWidth: 4, borderRightColor: colors.border, borderTopColor: colors.border, borderBottomColor: colors.border }}>
                                <Text className="text-[10px] font-semibold text-muted uppercase">Aktiv</Text>
                                <Text className="text-2xl font-bold" style={{ color: "#3B82F6" }}>{activeCount}</Text>
                            </View>
                            <View className="flex-1 bg-surface rounded-lg border-l-4 p-3" style={{ borderColor: "#8B5CF6", borderWidth: 1, borderLeftWidth: 4, borderRightColor: colors.border, borderTopColor: colors.border, borderBottomColor: colors.border }}>
                                <Text className="text-[10px] font-semibold text-muted uppercase">In Planung</Text>
                                <Text className="text-2xl font-bold" style={{ color: "#8B5CF6" }}>{planningCount}</Text>
                            </View>
                            <View className="flex-1 bg-surface rounded-lg border-l-4 p-3" style={{ borderColor: "#EF4444", borderWidth: 1, borderLeftWidth: 4, borderRightColor: colors.border, borderTopColor: colors.border, borderBottomColor: colors.border }}>
                                <Text className="text-[10px] font-semibold text-muted uppercase">Überfällig</Text>
                                <Text className="text-2xl font-bold" style={{ color: "#EF4444" }}>{overdueCount}</Text>
                            </View>
                        </View>

                        {/* ── Content ── */}
                        {isLoading ? (
                            <View className="items-center justify-center py-12">
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        ) : viewMode === "kanban" ? (
                            /* Kanban Board */
                            isWide ? (
                                <View className="flex-row gap-3">
                                    {KANBAN_COLUMNS.map(col => renderKanbanColumn(col))}
                                </View>
                            ) : (
                                /* Mobile: stacked columns */
                                <View className="gap-3">
                                    {KANBAN_COLUMNS.map(col => renderKanbanColumn(col))}
                                </View>
                            )
                        ) : (
                            /* List View */
                            filteredProjects.length > 0 ? (
                                <View>
                                    {filteredProjects.map((p: any) => renderProjectCard(p, true))}
                                </View>
                            ) : (
                                <View className="items-center justify-center py-12">
                                    <IconSymbol name="folder" size={48} color={colors.muted} />
                                    <Text className="text-base text-muted mt-4">Keine Projekte gefunden</Text>
                                    {!search && (
                                        <TouchableOpacity
                                            className="mt-4 bg-primary px-6 py-3 rounded-lg"
                                            onPress={() => setShowCreateModal(true)}
                                            activeOpacity={0.8}
                                        >
                                            <Text className="font-semibold" style={{ color: "#111" }}>
                                                Erstes Projekt erstellen
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )
                        )}

                        <View style={{ height: 24 }} />
                    </View>
                </View>
            </ScrollView>

            <ProjectFormModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["projects"] });
                }}
            />

            {selectedProject && (
                <ProjectDetailModal
                    visible={showDetailModal}
                    project={selectedProject}
                    onClose={() => {
                        setShowDetailModal(false);
                        setSelectedProject(null);
                    }}
                    onUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: ["projects"] });
                    }}
                />
            )}
        </ScreenContainer>
    );
}
