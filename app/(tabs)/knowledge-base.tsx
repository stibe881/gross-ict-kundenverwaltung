import { useState, useEffect } from "react";
import {
    ScrollView,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    Modal,
    RefreshControl,
    Linking,
} from "react-native";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { showToast } from "@/components/toast-provider";
import { formatDate } from "@/lib/format";
import { KbArticleFormModal } from "@/components/kb-article-form-modal";
import { KbArticleDetailModal } from "@/components/kb-article-detail-modal";

type SortOption = "newest" | "popular" | "alphabetical";

export default function KnowledgeBaseScreen() {
    const router = useRouter();
    const colors = useColors();
    const { isWide, containerStyle, contentPadding } = useResponsiveLayout();
    const queryClient = useQueryClient();
    const { refreshing, onRefresh } = useGlobalRefresh();

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [sort, setSort] = useState<SortOption>("newest");
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<any>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);

    // Deep-Link aus dem Ticket-Detail: /knowledge-base?articleId=...
    const { articleId } = useLocalSearchParams();
    useEffect(() => {
        if (!articleId) return;
        Data.getKbArticleById(String(articleId))
            .then((a) => { if (a) setSelectedArticle(a); })
            .catch(() => {});
    }, [articleId]);

    const { data: categories = [] } = useQuery({
        queryKey: ["kb_categories"],
        queryFn: Data.getKbCategories,
    });

    const { data: articles = [], isLoading } = useQuery({
        queryKey: ["kb_articles", selectedCategory, statusFilter, sort, search],
        queryFn: () =>
            Data.getKbArticles({
                category_id: selectedCategory || undefined,
                status: statusFilter || undefined,
                sort,
                search: search || undefined,
            }),
    });

    const totalArticles = articles.length;
    const publishedCount = articles.filter((a: any) => a.status === "published").length;
    const draftCount = articles.filter((a: any) => a.status === "draft").length;

    const renderArticleItem = ({ item }: { item: any }) => {
        const catColor = item.category?.color || "#0EA5E9";
        const statusColor = item.status === "published" ? colors.success
            : item.status === "draft" ? colors.warning
                : colors.muted;
        const statusLabel = item.status === "published" ? "Veröffentlicht"
            : item.status === "draft" ? "Entwurf"
                : "Archiviert";

        return (
            <TouchableOpacity
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
                activeOpacity={0.7}
                onPress={() => setSelectedArticle(item)}
            >
                <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-3">
                        <View className="flex-row items-center gap-2 mb-1">
                            {item.is_pinned && (
                                <IconSymbol name="pin.fill" size={12} color={colors.primary} />
                            )}
                            <IconSymbol
                                name={item.visibility === "public" ? "globe" : "lock.fill"}
                                size={11}
                                color={item.visibility === "public" ? colors.success : colors.muted}
                            />
                            <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={2}>
                                {item.title}
                            </Text>
                        </View>
                        <Text className="text-sm text-muted" numberOfLines={2}>
                            {item.content?.replace(/[#*`>\-]/g, "").substring(0, 120)}
                            {(item.content?.length ?? 0) > 120 ? "..." : ""}
                        </Text>
                    </View>
                    <View className="items-end gap-1">
                        <View
                            className="px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: statusColor + "20" }}
                        >
                            <Text className="text-[10px] font-semibold" style={{ color: statusColor }}>
                                {statusLabel}
                            </Text>
                        </View>
                        {item.category && (
                            <View
                                className="px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: catColor + "20" }}
                            >
                                <Text className="text-[10px] font-semibold" style={{ color: catColor }}>
                                    {item.category.name}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View className="flex-row items-center justify-between mt-1">
                    <View className="flex-row items-center gap-3">
                        {item.tags && item.tags.length > 0 && (
                            <View className="flex-row gap-1">
                                {item.tags.slice(0, 3).map((tag: string, i: number) => (
                                    <Text key={i} className="text-[10px] text-primary">#{tag}</Text>
                                ))}
                                {item.tags.length > 3 && (
                                    <Text className="text-[10px] text-muted">+{item.tags.length - 3}</Text>
                                )}
                            </View>
                        )}
                    </View>
                    <View className="flex-row items-center gap-3">
                        <View className="flex-row items-center gap-1">
                            <IconSymbol name="eye.fill" size={10} color={colors.muted} />
                            <Text className="text-[10px] text-muted">{item.view_count || 0}</Text>
                        </View>
                        <Text className="text-[10px] text-muted">{formatDate(item.created_at)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenContainer>
            <View className="flex-1" style={{ padding: contentPadding }}>
                <View style={containerStyle}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-3">
                            <BackButton />
                            <View>
                                <Text className="text-3xl font-bold text-foreground">Wissensdatenbank</Text>
                                <Text className="text-sm text-muted">Anleitungen, FAQs & Dokumentation</Text>
                            </View>
                        </View>
                        <View className="flex-row gap-2">
                            <TouchableOpacity
                                className="bg-surface border border-border w-10 h-10 rounded-full items-center justify-center"
                                activeOpacity={0.8}
                                onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/help-page`)}
                            >
                                <IconSymbol name="globe" size={18} color={colors.success} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-surface border border-border w-10 h-10 rounded-full items-center justify-center"
                                activeOpacity={0.8}
                                onPress={() => setShowCategoryModal(true)}
                            >
                                <IconSymbol name="folder.fill" size={18} color={colors.foreground} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-primary w-10 h-10 rounded-full items-center justify-center"
                                activeOpacity={0.8}
                                onPress={() => setShowAddModal(true)}
                            >
                                <IconSymbol name="plus.circle.fill" size={20} color={colors.background} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats */}
                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1 bg-surface rounded-lg p-2 border border-border">
                            <Text className="text-lg font-bold text-foreground">{totalArticles}</Text>
                            <Text className="text-[10px] text-muted">Gesamt</Text>
                        </View>
                        <View className="flex-1 bg-surface rounded-lg p-2 border border-border">
                            <Text className="text-lg font-bold text-success">{publishedCount}</Text>
                            <Text className="text-[10px] text-muted">Veröffentlicht</Text>
                        </View>
                        <View className="flex-1 bg-surface rounded-lg p-2 border border-border">
                            <Text className="text-lg font-bold text-warning">{draftCount}</Text>
                            <Text className="text-[10px] text-muted">Entwürfe</Text>
                        </View>
                    </View>

                    {/* Search */}
                    <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2 mb-3 gap-2">
                        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                        <TextInput
                            className="flex-1 text-foreground text-sm"
                            placeholder="Artikel suchen..."
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

                    {/* Category Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" style={{ flexGrow: 0 }}>
                        <View className="flex-row gap-2">
                            <TouchableOpacity
                                className={`px-3 py-1.5 rounded-md ${!selectedCategory ? "bg-primary" : "bg-surface border border-border"}`}
                                onPress={() => setSelectedCategory("")}
                            >
                                <Text className={`text-sm font-semibold ${!selectedCategory ? "text-background" : "text-foreground"}`}>
                                    Alle
                                </Text>
                            </TouchableOpacity>
                            {categories.map((cat: any) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    className="px-3 py-1.5 rounded-md"
                                    style={{
                                        backgroundColor: selectedCategory === cat.id ? (cat.color || colors.primary) : colors.surface,
                                        borderWidth: selectedCategory === cat.id ? 0 : 1,
                                        borderColor: colors.border,
                                    }}
                                    onPress={() => setSelectedCategory(selectedCategory === cat.id ? "" : cat.id)}
                                >
                                    <Text
                                        className="text-sm font-semibold"
                                        style={{ color: selectedCategory === cat.id ? "#FFF" : colors.foreground }}
                                    >
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Status & Sort Filters */}
                    <View className="flex-row items-center justify-between mb-4">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                            <View className="flex-row gap-2">
                                {[
                                    { key: "", label: "Alle Status" },
                                    { key: "published", label: "Veröffentlicht" },
                                    { key: "draft", label: "Entwürfe" },
                                    { key: "archived", label: "Archiviert" },
                                ].map((opt) => (
                                    <TouchableOpacity
                                        key={opt.key}
                                        className="px-2 py-1 rounded-md"
                                        style={{
                                            backgroundColor: statusFilter === opt.key
                                                ? colors.primary + "20"
                                                : "transparent",
                                        }}
                                        onPress={() => setStatusFilter(opt.key)}
                                    >
                                        <Text
                                            className="text-xs font-semibold"
                                            style={{
                                                color: statusFilter === opt.key ? colors.primary : colors.muted,
                                            }}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View className="flex-row gap-1">
                            {[
                                { key: "newest" as SortOption, icon: "clock.fill" },
                                { key: "popular" as SortOption, icon: "flame.fill" },
                                { key: "alphabetical" as SortOption, icon: "textformat.abc" },
                            ].map((opt) => (
                                <TouchableOpacity
                                    key={opt.key}
                                    className="w-8 h-8 rounded-md items-center justify-center"
                                    style={{
                                        backgroundColor: sort === opt.key ? colors.primary + "20" : "transparent",
                                    }}
                                    onPress={() => setSort(opt.key)}
                                >
                                    <IconSymbol
                                        name={opt.icon as any}
                                        size={14}
                                        color={sort === opt.key ? colors.primary : colors.muted}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Article List */}
                    {isLoading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : articles.length > 0 ? (
                        <FlatList
                            data={articles}
                            renderItem={renderArticleItem}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <IconSymbol name="book.fill" size={48} color={colors.muted} />
                            <Text className="text-lg text-muted mt-4">Keine Artikel gefunden</Text>
                            <Text className="text-sm text-muted text-center mt-2">
                                {search
                                    ? `Keine Treffer für "${search}"`
                                    : "Erstellen Sie Ihren ersten Wissensdatenbank-Artikel"}
                            </Text>
                            {!search && (
                                <TouchableOpacity
                                    className="mt-4 bg-primary px-6 py-3 rounded-lg"
                                    onPress={() => setShowAddModal(true)}
                                    activeOpacity={0.8}
                                >
                                    <Text className="font-semibold" style={{ color: colors.background }}>
                                        Artikel erstellen
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </View>

            {/* Article Form Modal */}
            <KbArticleFormModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={() => { }}
            />

            {/* Article Detail Modal */}
            {selectedArticle && (
                <KbArticleDetailModal
                    article={selectedArticle}
                    onClose={() => setSelectedArticle(null)}
                    onNavigate={(article) => setSelectedArticle(article)}
                />
            )}

            {/* Category Management Modal */}
            {showCategoryModal && (
                <CategoryManagementModal
                    onClose={() => setShowCategoryModal(false)}
                />
            )}
        </ScreenContainer>
    );
}

// ── Category Management Modal ──

function CategoryManagementModal({ onClose }: { onClose: () => void }) {
    const colors = useColors();
    const queryClient = useQueryClient();
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#0EA5E9");
    const [newDescription, setNewDescription] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: categories = [] } = useQuery({
        queryKey: ["kb_categories"],
        queryFn: Data.getKbCategories,
    });

    const colorOptions = [
        "#0EA5E9", "#6366F1", "#EC4899", "#14B8A6",
        "#F97316", "#8B5CF6", "#EF4444", "#22C55E",
    ];

    const createMutation = useMutation({
        mutationFn: () => {
            if (editingId) {
                return Data.updateKbCategory(editingId, {
                    name: newName.trim(),
                    color: newColor,
                    description: newDescription.trim() || null,
                });
            }
            return Data.createKbCategory({
                name: newName.trim(),
                color: newColor,
                description: newDescription.trim() || undefined,
                sort_order: categories.length,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kb_categories"] });
            setNewName("");
            setNewDescription("");
            setNewColor("#0EA5E9");
            setEditingId(null);
            showAlert("Erfolg", editingId ? "Kategorie aktualisiert" : "Kategorie erstellt");
        },
        onError: (err: any) => showAlert("Fehler", err.message),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => Data.deleteKbCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kb_categories"] });
            showToast("Kategorie gelöscht");
        },
        onError: (err: any) => showAlert("Fehler", err.message),
    });

    const startEdit = (cat: any) => {
        setEditingId(cat.id);
        setNewName(cat.name);
        setNewColor(cat.color || "#0EA5E9");
        setNewDescription(cat.description || "");
    };

    return (
        <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-background rounded-t-3xl" style={{ maxHeight: "80%" }}>
                    <View className="flex-row items-center justify-between p-4 border-b border-border">
                        <Text className="text-xl font-bold text-foreground">Kategorien verwalten</Text>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                            <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                        {/* Category List */}
                        <View className="gap-2 mb-6">
                            {categories.length === 0 ? (
                                <Text className="text-sm text-muted text-center py-4">
                                    Noch keine Kategorien vorhanden
                                </Text>
                            ) : (
                                categories.map((cat: any) => (
                                    <View
                                        key={cat.id}
                                        className="flex-row items-center justify-between bg-surface border border-border rounded-lg px-3 py-3"
                                    >
                                        <View className="flex-row items-center gap-3 flex-1">
                                            <View
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: cat.color || "#0EA5E9" }}
                                            />
                                            <View className="flex-1">
                                                <Text className="text-sm font-semibold text-foreground">{cat.name}</Text>
                                                {cat.description && (
                                                    <Text className="text-xs text-muted" numberOfLines={1}>{cat.description}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <View className="flex-row gap-2">
                                            <TouchableOpacity onPress={() => startEdit(cat)} activeOpacity={0.7}>
                                                <IconSymbol name="pencil" size={16} color={colors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() =>
                                                    showConfirm(
                                                        "Kategorie löschen",
                                                        `"${cat.name}" wirklich löschen?`,
                                                        () => deleteMutation.mutate(cat.id),
                                                        "Löschen"
                                                    )
                                                }
                                                activeOpacity={0.7}
                                            >
                                                <IconSymbol name="trash.fill" size={16} color={colors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Add / Edit Form */}
                        <View className="bg-surface border border-border rounded-xl p-4 gap-3">
                            <Text className="text-sm font-semibold text-foreground">
                                {editingId ? "Kategorie bearbeiten" : "Neue Kategorie"}
                            </Text>
                            <TextInput
                                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                placeholder="Kategoriename..."
                                placeholderTextColor={colors.muted}
                                value={newName}
                                onChangeText={setNewName}
                            />
                            <TextInput
                                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm"
                                placeholder="Beschreibung (optional)"
                                placeholderTextColor={colors.muted}
                                value={newDescription}
                                onChangeText={setNewDescription}
                            />
                            <View className="flex-row gap-2">
                                {colorOptions.map((c) => (
                                    <TouchableOpacity
                                        key={c}
                                        className="w-8 h-8 rounded-full items-center justify-center"
                                        style={{
                                            backgroundColor: c,
                                            borderWidth: newColor === c ? 3 : 0,
                                            borderColor: "#FFF",
                                        }}
                                        onPress={() => setNewColor(c)}
                                    >
                                        {newColor === c && (
                                            <IconSymbol name="checkmark" size={14} color="#FFF" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View className="flex-row gap-2">
                                {editingId && (
                                    <TouchableOpacity
                                        className="flex-1 bg-background border border-border py-2 rounded-lg"
                                        onPress={() => {
                                            setEditingId(null);
                                            setNewName("");
                                            setNewDescription("");
                                            setNewColor("#0EA5E9");
                                        }}
                                    >
                                        <Text className="text-foreground font-semibold text-center text-sm">Abbrechen</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    className="flex-1 bg-primary py-2 rounded-lg"
                                    onPress={() => createMutation.mutate()}
                                    disabled={!newName.trim() || createMutation.isPending}
                                    style={{ opacity: !newName.trim() ? 0.5 : 1 }}
                                >
                                    <Text className="font-semibold text-center text-sm" style={{ color: colors.background }}>
                                        {editingId ? "Aktualisieren" : "Hinzufügen"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={{ height: 24 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
