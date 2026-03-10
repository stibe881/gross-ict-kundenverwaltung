import { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { ProjectFormModal } from "@/components/project-form-modal";
import { ProjectDetailModal } from "@/components/project-detail-modal";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    planning: { label: "Planung", color: "#6B7280", icon: "clipboard" },
    in_progress: { label: "In Arbeit", color: "#3B82F6", icon: "arrow.triangle.2.circlepath" },
    completed: { label: "Abgeschlossen", color: "#10B981", icon: "checkmark.circle.fill" },
    cancelled: { label: "Abgebrochen", color: "#EF4444", icon: "xmark.circle.fill" },
};

export default function ProjectsScreen() {
    const colors = useColors();
    const { containerStyle, contentPadding } = useResponsiveLayout();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);

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

    const filteredProjects = filterStatus
        ? (projects || []).filter((p: any) => p.status === filterStatus)
        : projects || [];

    const getProgress = (project: any) => {
        const milestones = project.milestones || [];
        if (milestones.length === 0) return null;
        const completed = milestones.filter((m: any) => m.status === "completed").length;
        return { completed, total: milestones.length, percent: Math.round((completed / milestones.length) * 100) };
    };

    const handleDelete = (project: any) => {
        Alert.alert(
            "Projekt löschen",
            `Möchten Sie "${project.title}" wirklich löschen?`,
            [
                { text: "Abbrechen", style: "cancel" },
                {
                    text: "Löschen",
                    style: "destructive",
                    onPress: async () => {
                        await Data.deleteProject(project.id);
                        queryClient.invalidateQueries({ queryKey: ["projects"] });
                    },
                },
            ]
        );
    };

    const renderProject = ({ item }: { item: any }) => {
        const customerName =
            item.customer?.company_name ||
            `${item.customer?.first_name || ""} ${item.customer?.last_name || ""}`.trim() ||
            "Kein Kunde";
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.planning;
        const progress = getProgress(item);

        return (
            <TouchableOpacity
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
                activeOpacity={0.7}
                onPress={() => {
                    setSelectedProject(item);
                    setShowDetailModal(true);
                }}
                onLongPress={() => handleDelete(item)}
            >
                <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                        <Text className="text-xs text-muted">{item.project_number}</Text>
                        <Text className="text-base font-semibold text-foreground mt-0.5">
                            {item.title}
                        </Text>
                        <Text className="text-sm text-muted mt-1">{customerName}</Text>
                    </View>
                    <View className="flex-row gap-2">
                        {item.priority && item.priority !== "medium" && (
                            <View
                                style={{
                                    backgroundColor: (item.priority === "urgent" ? "#DC2626" : item.priority === "high" ? "#EF4444" : "#6B7280") + "20",
                                    paddingHorizontal: 6,
                                    paddingVertical: 3,
                                    borderRadius: 12,
                                }}
                            >
                                <Text
                                    style={{
                                        color: item.priority === "urgent" ? "#DC2626" : item.priority === "high" ? "#EF4444" : "#6B7280",
                                        fontSize: 11,
                                        fontWeight: "600",
                                    }}
                                >
                                    {item.priority === "urgent" ? "!!" : item.priority === "high" ? "↑" : "↓"}
                                </Text>
                            </View>
                        )}
                        <View
                            style={{ backgroundColor: config.color + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}
                        >
                            <Text style={{ color: config.color, fontSize: 12, fontWeight: "600" }}>
                                {config.label}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Progress Bar */}
                {progress && (
                    <View className="mt-2">
                        <View className="flex-row justify-between mb-1">
                            <Text className="text-xs text-muted">
                                {progress.completed}/{progress.total} Meilensteine
                            </Text>
                            <Text className="text-xs font-semibold" style={{ color: config.color }}>
                                {progress.percent}%
                            </Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2 }}>
                            <View
                                style={{
                                    height: 4,
                                    width: `${progress.percent}%`,
                                    backgroundColor: config.color,
                                    borderRadius: 2,
                                }}
                            />
                        </View>
                    </View>
                )}

                <View className="flex-row justify-between items-center mt-3">
                    <Text className="text-sm text-muted">
                        {item.start_date ? formatDate(item.start_date) : "Kein Startdatum"}
                        {item.end_date ? ` – ${formatDate(item.end_date)}` : ""}
                    </Text>
                    {item.budget > 0 && (
                        <Text className="text-base font-bold text-foreground">
                            {formatCurrency(item.budget)}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenContainer>
            <View className="flex-1" style={{ padding: contentPadding }}>
                <View style={containerStyle}>
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                            <View>
                                <Text className="text-2xl font-bold text-foreground">Projekte</Text>
                                <Text className="text-sm text-muted mt-1">
                                    {filteredProjects.length} Projekte
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowCreateModal(true)}
                            style={{ backgroundColor: colors.primary }}
                            className="w-10 h-10 rounded-full items-center justify-center"
                        >
                            <IconSymbol name="plus" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Filter */}
                    <View className="flex-row gap-2 mb-4 flex-wrap">
                        <TouchableOpacity
                            onPress={() => setFilterStatus(null)}
                            style={{
                                backgroundColor: filterStatus === null ? colors.primary : colors.surface,
                                borderColor: colors.border,
                            }}
                            className="px-3 py-1.5 rounded-full border"
                        >
                            <Text
                                style={{
                                    color: filterStatus === null ? "#fff" : colors.foreground,
                                    fontSize: 13,
                                    fontWeight: "600",
                                }}
                            >
                                Alle
                            </Text>
                        </TouchableOpacity>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => setFilterStatus(key)}
                                style={{
                                    backgroundColor: filterStatus === key ? config.color : colors.surface,
                                    borderColor: colors.border,
                                }}
                                className="px-3 py-1.5 rounded-full border"
                            >
                                <Text
                                    style={{
                                        color: filterStatus === key ? "#fff" : colors.foreground,
                                        fontSize: 13,
                                        fontWeight: "600",
                                    }}
                                >
                                    {config.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Liste */}
                    {isLoading && !projects ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredProjects}
                            renderItem={renderProject}
                            keyExtractor={(item) => item.id}
                            refreshControl={
                                <RefreshControl refreshing={false} onRefresh={refetch} />
                            }
                            ListEmptyComponent={
                                <View className="items-center justify-center py-12">
                                    <IconSymbol name="folder" size={48} color={colors.muted} />
                                    <Text className="text-muted text-base mt-4">
                                        Keine Projekte vorhanden
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setShowCreateModal(true)}
                                        style={{ backgroundColor: colors.primary }}
                                        className="mt-4 px-6 py-3 rounded-lg"
                                    >
                                        <Text className="text-background font-semibold">
                                            Erstes Projekt erstellen
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>

            <ProjectFormModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["projects"] });
                }}
            />

            {
                selectedProject && (
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
                )
            }
        </ScreenContainer >
    );
}
