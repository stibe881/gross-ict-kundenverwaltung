import { useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
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
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { exportCsv } from "@/lib/export";
import { formatDate, formatCurrency } from "@/lib/format";
import { showConfirm } from "@/lib/alert";
import { ProjectFormModal } from "@/components/project-form-modal";
import { ProjectDetailModal } from "@/components/project-detail-modal";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; order: number }> = {
    in_progress: { label: "Aktiv", color: "#3B82F6", icon: "play.fill", order: 0 },
    planning: { label: "Planung", color: "#8B5CF6", icon: "lightbulb.fill", order: 1 },
    on_hold: { label: "Pausiert", color: "#F59E0B", icon: "pause.fill", order: 2 },
    completed: { label: "Abgeschlossen", color: "#10B981", icon: "checkmark.circle.fill", order: 3 },
    cancelled: { label: "Abgebrochen", color: "#EF4444", icon: "xmark", order: 4 },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: "Hoch", color: "#EF4444" },
    urgent: { label: "Dringend", color: "#DC2626" },
};

// Filter-Chips: Alle + Status + Überfällig
const FILTERS: { key: string; label: string; color?: string }[] = [
    { key: "all", label: "Alle" },
    { key: "in_progress", label: "Aktiv" },
    { key: "planning", label: "Planung" },
    { key: "on_hold", label: "Pausiert" },
    { key: "overdue", label: "Überfällig", color: "#EF4444" },
    { key: "completed", label: "Abgeschlossen" },
];

type ViewMode = "board" | "list";

const KANBAN_COLUMNS = ["in_progress", "planning", "on_hold", "completed"];

export default function ProjectsScreen() {
    const colors = useColors();
    const { containerStyle, contentPadding, isWide } = useResponsiveLayout();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [filter, setFilter] = useState("in_progress");
    const [search, setSearch] = useState("");
    const { refreshing, onRefresh } = useGlobalRefresh();

    const { data: projects, isLoading, refetch } = useQuery({
        queryKey: ["projects"],
        queryFn: Data.getAllProjects,
    });

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [])
    );

    // ── Helpers ──
    const isOverdue = (p: any) =>
        p.status !== "completed" && p.status !== "cancelled" &&
        !!p.end_date && new Date(p.end_date) < new Date();

    const getProgress = (p: any) => {
        const ms = p.milestones || [];
        if (ms.length === 0) return null;
        const done = ms.filter((m: any) => m.status === "completed").length;
        return { done, total: ms.length, pct: Math.round((done / ms.length) * 100) };
    };

    const getCustomerName = (p: any) =>
        p.customer?.company_name ||
        `${p.customer?.first_name || ""} ${p.customer?.last_name || ""}`.trim() ||
        null;

    // ── Derived data ──
    const allProjects = projects || [];

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: allProjects.length, overdue: 0 };
        Object.keys(STATUS_CONFIG).forEach(k => { c[k] = 0; });
        allProjects.forEach((p: any) => {
            c[p.status] = (c[p.status] || 0) + 1;
            if (isOverdue(p)) c.overdue++;
        });
        return c;
    }, [allProjects]);

    const filteredProjects = useMemo(() => {
        let list = allProjects;
        if (filter === "overdue") list = list.filter(isOverdue);
        else if (filter !== "all") list = list.filter((p: any) => p.status === filter);

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((p: any) =>
                p.title?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q) ||
                p.project_number?.toLowerCase().includes(q) ||
                getCustomerName(p)?.toLowerCase().includes(q)
            );
        }

        // Sortierung: laufende zuerst, überfällige nach vorne, dann nach Endtermin
        return [...list].sort((a: any, b: any) => {
            const oa = STATUS_CONFIG[a.status]?.order ?? 9;
            const ob = STATUS_CONFIG[b.status]?.order ?? 9;
            if (oa !== ob) return oa - ob;
            const da = isOverdue(a) ? 0 : 1;
            const db = isOverdue(b) ? 0 : 1;
            if (da !== db) return da - db;
            if (a.end_date && b.end_date) return a.end_date.localeCompare(b.end_date);
            if (a.end_date) return -1;
            if (b.end_date) return 1;
            return (a.title || "").localeCompare(b.title || "", "de");
        });
    }, [allProjects, filter, search]);

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

    // ── Projekt-Karte ──
    const renderProjectCard = (project: any, compact = false) => {
        const statusConf = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning;
        const prioConf = PRIORITY_CONFIG[project.priority];
        const progress = getProgress(project);
        const overdue = isOverdue(project);
        const customerName = getCustomerName(project);
        const done = project.status === "completed" || project.status === "cancelled";

        return (
            <TouchableOpacity
                key={project.id}
                className="bg-surface rounded-xl border border-border overflow-hidden"
                style={{ marginBottom: compact ? 8 : 12, flexDirection: "row", opacity: done ? 0.8 : 1 }}
                activeOpacity={0.7}
                onPress={() => openProject(project)}
                onLongPress={() => handleDelete(project)}
            >
                {/* Farbiger Status-Streifen links */}
                <View style={{ width: 4, backgroundColor: overdue ? "#EF4444" : statusConf.color }} />

                <View className="flex-1 p-3.5">
                    {/* Kopfzeile: Nummer + Priorität + Status */}
                    <View className="flex-row items-center mb-1.5">
                        <Text className="text-[11px] font-semibold text-muted" numberOfLines={1}>
                            {project.project_number}
                        </Text>
                        {prioConf && !done && (
                            <View className="flex-row items-center ml-2 px-1.5 py-0.5 rounded" style={{ backgroundColor: prioConf.color + "18" }}>
                                <IconSymbol name="flag.fill" size={9} color={prioConf.color} />
                                <Text className="text-[10px] font-bold ml-1" style={{ color: prioConf.color }}>{prioConf.label}</Text>
                            </View>
                        )}
                        <View className="flex-1" />
                        <View className="flex-row items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: statusConf.color + "18" }}>
                            <IconSymbol name={statusConf.icon as any} size={10} color={statusConf.color} />
                            <Text className="text-[10px] font-bold ml-1" style={{ color: statusConf.color }}>
                                {statusConf.label}
                            </Text>
                        </View>
                    </View>

                    {/* Titel + Kunde */}
                    <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                        {project.title}
                    </Text>
                    {customerName && (
                        <View className="flex-row items-center mt-0.5">
                            <IconSymbol name="person.fill" size={11} color={colors.muted} />
                            <Text className="text-xs text-muted ml-1" numberOfLines={1}>{customerName}</Text>
                        </View>
                    )}

                    {/* Fortschritt über Meilensteine */}
                    {progress && (
                        <View className="mt-2.5">
                            <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                                <View style={{ height: 5, width: `${progress.pct}%` as any, backgroundColor: progress.pct === 100 ? "#10B981" : statusConf.color, borderRadius: 3 }} />
                            </View>
                            <Text className="text-[10px] text-muted mt-1">
                                {progress.done} von {progress.total} Meilensteinen · {progress.pct}%
                            </Text>
                        </View>
                    )}

                    {/* Fusszeile: Termin + Budget */}
                    {(project.end_date || project.budget) && (
                        <View className="flex-row items-center mt-2">
                            {project.end_date && (
                                <View className="flex-row items-center flex-1">
                                    <IconSymbol
                                        name={overdue ? "exclamationmark.triangle.fill" : "calendar"}
                                        size={11}
                                        color={overdue ? "#EF4444" : colors.muted}
                                    />
                                    <Text className="text-[11px] ml-1" style={{ color: overdue ? "#EF4444" : colors.muted, fontWeight: overdue ? "700" : "400" }}>
                                        {overdue ? `Überfällig seit ${formatDate(project.end_date)}` : `Bis ${formatDate(project.end_date)}`}
                                    </Text>
                                </View>
                            )}
                            {!project.end_date && <View className="flex-1" />}
                            {!!project.budget && (
                                <Text className="text-[11px] font-semibold text-foreground">
                                    {formatCurrency(project.budget, 0)}
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // ── Kanban-Spalte (nur Desktop) ──
    const renderKanbanColumn = (statusKey: string) => {
        const conf = STATUS_CONFIG[statusKey];
        const items = filteredProjects.filter((p: any) => p.status === statusKey);

        return (
            <View key={statusKey} className="flex-1 bg-background rounded-xl border border-border">
                <View className="flex-row items-center gap-2 px-3 py-2.5 border-b border-border">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: conf.color }} />
                    <Text className="text-sm font-semibold text-foreground">{conf.label}</Text>
                    <Text className="text-xs font-bold" style={{ color: conf.color }}>{items.length}</Text>
                </View>
                <ScrollView className="p-2" style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {items.length === 0 ? (
                        <Text className="text-xs text-muted text-center py-6">Keine Projekte</Text>
                    ) : (
                        items.map((p: any) => renderProjectCard(p, true))
                    )}
                </ScrollView>
            </View>
        );
    };

    return (
        <ScreenContainer>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={{ padding: contentPadding }}>
                    <View style={containerStyle}>
                        {/* ── Kopfzeile ── */}
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center gap-3 flex-1">
                                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                                    <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                                </TouchableOpacity>
                                <View>
                                    <Text className="text-2xl font-bold text-foreground">Projekte</Text>
                                    <Text className="text-xs text-muted">
                                        {counts.all} {counts.all === 1 ? "Projekt" : "Projekte"} · {counts.in_progress || 0} aktiv
                                        {counts.overdue > 0 ? ` · ${counts.overdue} überfällig` : ""}
                                    </Text>
                                </View>
                            </View>

                            <View className="flex-row items-center gap-2">
                                {isWide && (
                                    <View className="flex-row bg-surface border border-border rounded-lg overflow-hidden">
                                        {([["list", "list.bullet", "Liste"], ["board", "square.grid.2x2.fill", "Board"]] as const).map(([mode, icon, label]) => (
                                            <TouchableOpacity
                                                key={mode}
                                                className="flex-row items-center gap-1 px-3 py-2"
                                                style={{ backgroundColor: viewMode === mode ? colors.primary : "transparent" }}
                                                onPress={() => setViewMode(mode)}
                                                activeOpacity={0.8}
                                            >
                                                <IconSymbol name={icon as any} size={12} color={viewMode === mode ? colors.background : colors.muted} />
                                                <Text className="text-xs font-semibold" style={{ color: viewMode === mode ? colors.background : colors.foreground }}>{label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                                <TouchableOpacity
                                    className="w-10 h-10 rounded-full items-center justify-center border border-border bg-surface"
                                    onPress={() =>
                                        exportCsv("Projekte.csv", filteredProjects || [], [
                                            { key: "project_number", label: "Nummer" },
                                            { key: "title", label: "Titel" },
                                            { key: "status", label: "Status" },
                                            { key: "customer", label: "Kunde", map: (p: any) => p.customer?.company_name || `${p.customer?.first_name || ""} ${p.customer?.last_name || ""}`.trim() },
                                            { key: "budget", label: "Budget" },
                                            { key: "created_at", label: "Erstellt", map: (p: any) => (p.created_at || "").split("T")[0] },
                                        ]).catch(() => {})
                                    }
                                    activeOpacity={0.8}
                                >
                                    <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="w-10 h-10 rounded-full items-center justify-center"
                                    style={{ backgroundColor: colors.primary }}
                                    onPress={() => setShowCreateModal(true)}
                                    activeOpacity={0.8}
                                >
                                    <IconSymbol name="plus" size={22} color={colors.background} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* ── Suche ── */}
                        <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2.5 gap-2 mb-3">
                            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
                            <TextInput
                                className="flex-1 text-foreground text-sm"
                                placeholder="Projekt, Kunde oder Nummer suchen..."
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

                        {/* ── Filter-Chips mit Zählern ── */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8 }}>
                            {FILTERS.map(f => {
                                const active = filter === f.key;
                                const chipColor = f.color || STATUS_CONFIG[f.key]?.color || colors.primary;
                                const count = counts[f.key] || 0;
                                if (f.key === "overdue" && count === 0) return null;
                                return (
                                    <TouchableOpacity
                                        key={f.key}
                                        className="flex-row items-center px-3 py-1.5 rounded-full border"
                                        style={{
                                            backgroundColor: active ? chipColor : colors.surface,
                                            borderColor: active ? chipColor : colors.border,
                                        }}
                                        onPress={() => setFilter(f.key)}
                                        activeOpacity={0.8}
                                    >
                                        {f.key === "overdue" && (
                                            <IconSymbol name="exclamationmark.triangle.fill" size={11} color={active ? "#fff" : chipColor} style={{ marginRight: 4 }} />
                                        )}
                                        <Text className="text-xs font-semibold" style={{ color: active ? "#fff" : colors.foreground }}>
                                            {f.label}
                                        </Text>
                                        <Text className="text-xs font-bold ml-1.5" style={{ color: active ? "#fff" : chipColor }}>
                                            {count}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* ── Inhalt ── */}
                        {isLoading ? (
                            <View className="items-center justify-center py-12">
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        ) : isWide && viewMode === "board" ? (
                            <View className="flex-row gap-3">
                                {KANBAN_COLUMNS.map(renderKanbanColumn)}
                            </View>
                        ) : filteredProjects.length > 0 ? (
                            isWide ? (
                                /* Desktop-Liste: zweispaltig */
                                <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                                    {filteredProjects.map((p: any) => (
                                        <View key={p.id} style={{ width: "50%", paddingHorizontal: 6 }}>
                                            {renderProjectCard(p)}
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View>{filteredProjects.map((p: any) => renderProjectCard(p))}</View>
                            )
                        ) : (
                            <View className="items-center justify-center py-16">
                                <IconSymbol name="folder" size={48} color={colors.muted} />
                                <Text className="text-base font-semibold text-foreground mt-4">
                                    {search || filter !== "all" ? "Keine Projekte gefunden" : "Noch keine Projekte"}
                                </Text>
                                <Text className="text-sm text-muted mt-1 text-center">
                                    {search || filter !== "all"
                                        ? "Suche oder Filter anpassen."
                                        : "Lege dein erstes Projekt an."}
                                </Text>
                                {!search && filter === "all" && (
                                    <TouchableOpacity
                                        className="mt-5 bg-primary px-6 py-3 rounded-xl"
                                        onPress={() => setShowCreateModal(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Text className="font-semibold" style={{ color: colors.background }}>
                                            Erstes Projekt erstellen
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Hinweis: Löschen über langes Drücken */}
                        {filteredProjects.length > 0 && (
                            <Text className="text-[10px] text-muted text-center mt-2">
                                Tipp: Projekt gedrückt halten, um es zu löschen
                            </Text>
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
