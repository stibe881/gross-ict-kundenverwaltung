import { useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Linking,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert, showConfirm } from "@/lib/alert";
import { formatDate } from "@/lib/format";
import { KbArticleFormModal } from "./kb-article-form-modal";

interface Props {
    article: any;
    onClose: () => void;
}

export function KbArticleDetailModal({ article: initialArticle, onClose }: Props) {
    const colors = useColors();
    const queryClient = useQueryClient();
    const [showEditModal, setShowEditModal] = useState(false);

    // Fetch full article with attachments and related
    const { data: article } = useQuery({
        queryKey: ["kb_article", initialArticle.id],
        queryFn: () => Data.getKbArticleById(initialArticle.id),
        initialData: initialArticle,
    });

    const { data: related = [] } = useQuery({
        queryKey: ["kb_related", initialArticle.id],
        queryFn: () => Data.getRelatedKbArticles(initialArticle.id),
    });

    const deleteMutation = useMutation({
        mutationFn: () => Data.deleteKbArticle(article.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kb_articles"] });
            showAlert("Erfolg", "Artikel gelöscht");
            onClose();
        },
        onError: (err: any) => showAlert("Fehler", err.message),
    });

    const handleDelete = () => {
        showConfirm(
            "Artikel löschen",
            "Möchten Sie diesen Artikel wirklich löschen?",
            () => deleteMutation.mutate(),
            "Löschen"
        );
    };

    const togglePin = useMutation({
        mutationFn: () => Data.updateKbArticle(article.id, { is_pinned: !article.is_pinned }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kb_articles"] });
            queryClient.invalidateQueries({ queryKey: ["kb_article", article.id] });
        },
    });

    const statusColor = article.status === "published" ? colors.success
        : article.status === "draft" ? colors.warning
            : colors.muted;

    const statusLabel = article.status === "published" ? "Veröffentlicht"
        : article.status === "draft" ? "Entwurf"
            : "Archiviert";

    // Simple markdown rendering
    const renderContent = (text: string) => {
        if (!text) return null;
        const lines = text.split("\n");
        return lines.map((line, i) => {
            const trimmed = line;
            // Headers
            if (trimmed.startsWith("### ")) {
                return (
                    <Text key={i} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 16, marginBottom: 4 }}>
                        {trimmed.replace("### ", "")}
                    </Text>
                );
            }
            if (trimmed.startsWith("## ")) {
                return (
                    <Text key={i} style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginTop: 20, marginBottom: 6 }}>
                        {trimmed.replace("## ", "")}
                    </Text>
                );
            }
            if (trimmed.startsWith("# ")) {
                return (
                    <Text key={i} style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, marginTop: 24, marginBottom: 8 }}>
                        {trimmed.replace("# ", "")}
                    </Text>
                );
            }
            // Bullet points
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                    <View key={i} style={{ flexDirection: "row", paddingLeft: 8, marginTop: 4 }}>
                        <Text style={{ color: colors.primary, marginRight: 8, fontSize: 14 }}>•</Text>
                        <Text style={{ flex: 1, fontSize: 14, color: colors.foreground, lineHeight: 22 }}>
                            {renderInlineMarkdown(trimmed.slice(2))}
                        </Text>
                    </View>
                );
            }
            // Code blocks (simple)
            if (trimmed.startsWith("```")) {
                return null; // Skip code fences
            }
            // Block quotes
            if (trimmed.startsWith("> ")) {
                return (
                    <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, marginVertical: 4 }}>
                        <Text style={{ fontSize: 14, color: colors.muted, fontStyle: "italic", lineHeight: 22 }}>
                            {trimmed.slice(2)}
                        </Text>
                    </View>
                );
            }
            // Empty line
            if (!trimmed.trim()) {
                return <View key={i} style={{ height: 8 }} />;
            }
            // Normal paragraph
            return (
                <Text key={i} style={{ fontSize: 14, color: colors.foreground, lineHeight: 22, marginTop: 2 }}>
                    {renderInlineMarkdown(trimmed)}
                </Text>
            );
        });
    };

    const renderInlineMarkdown = (text: string) => {
        // Very basic bold handling
        return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1");
    };

    return (
        <>
            <Modal visible={true} animationType="slide" transparent onRequestClose={onClose}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-background rounded-t-3xl" style={{ maxHeight: "95%" }}>
                        {/* Header */}
                        <View className="flex-row items-center justify-between p-4 border-b border-border">
                            <View className="flex-1 mr-4">
                                <View className="flex-row items-center gap-2 mb-1">
                                    <View
                                        className="px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: statusColor + "20" }}
                                    >
                                        <Text className="text-[10px] font-semibold" style={{ color: statusColor }}>
                                            {statusLabel}
                                        </Text>
                                    </View>
                                    {article.is_pinned && (
                                        <IconSymbol name="pin.fill" size={12} color={colors.primary} />
                                    )}
                                    {article.category && (
                                        <View
                                            className="px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: (article.category.color || "#0EA5E9") + "20" }}
                                        >
                                            <Text className="text-[10px] font-semibold" style={{ color: article.category.color || "#0EA5E9" }}>
                                                {article.category.name}
                                            </Text>
                                        </View>
                                    )}
                                    <View
                                        className="px-2 py-0.5 rounded-full flex-row items-center gap-1"
                                        style={{ backgroundColor: (article.visibility === "public" ? colors.success : colors.muted) + "20" }}
                                    >
                                        <IconSymbol
                                            name={article.visibility === "public" ? "globe" : "lock.fill"}
                                            size={10}
                                            color={article.visibility === "public" ? colors.success : colors.muted}
                                        />
                                        <Text className="text-[10px] font-semibold" style={{ color: article.visibility === "public" ? colors.success : colors.muted }}>
                                            {article.visibility === "public" ? "Öffentlich" : "Intern"}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
                                    {article.title}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                                <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                            {/* Meta */}
                            <View className="flex-row flex-wrap gap-4 mb-4">
                                <View className="flex-row items-center gap-1">
                                    <IconSymbol name="person.fill" size={12} color={colors.muted} />
                                    <Text className="text-xs text-muted">{article.author_name || "Admin"}</Text>
                                </View>
                                <View className="flex-row items-center gap-1">
                                    <IconSymbol name="calendar" size={12} color={colors.muted} />
                                    <Text className="text-xs text-muted">{formatDate(article.created_at)}</Text>
                                </View>
                                {article.updated_at !== article.created_at && (
                                    <View className="flex-row items-center gap-1">
                                        <IconSymbol name="clock.fill" size={12} color={colors.muted} />
                                        <Text className="text-xs text-muted">Aktualisiert: {formatDate(article.updated_at)}</Text>
                                    </View>
                                )}
                                <View className="flex-row items-center gap-1">
                                    <IconSymbol name="eye.fill" size={12} color={colors.muted} />
                                    <Text className="text-xs text-muted">{article.view_count || 0} Aufrufe</Text>
                                </View>
                            </View>

                            {/* Tags */}
                            {article.tags && article.tags.length > 0 && (
                                <View className="flex-row flex-wrap gap-1 mb-4">
                                    {article.tags.map((tag: string, i: number) => (
                                        <View
                                            key={i}
                                            className="px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: colors.primary + "15" }}
                                        >
                                            <Text className="text-xs" style={{ color: colors.primary }}>#{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Article Content */}
                            <View className="mb-6">
                                {renderContent(article.content || "")}
                            </View>

                            {/* Attachments */}
                            {article.attachments && article.attachments.length > 0 && (
                                <View className="mb-6">
                                    <Text className="text-sm font-semibold text-foreground mb-2">Anhänge</Text>
                                    {article.attachments.map((att: any) => (
                                        <TouchableOpacity
                                            key={att.id}
                                            className="flex-row items-center gap-3 bg-surface border border-border rounded-lg px-3 py-3 mb-2"
                                            onPress={() => att.file_url && Linking.openURL(att.file_url)}
                                            activeOpacity={0.7}
                                        >
                                            <IconSymbol name="doc.fill" size={20} color={colors.primary} />
                                            <View className="flex-1">
                                                <Text className="text-sm text-foreground" numberOfLines={1}>
                                                    {att.file_name}
                                                </Text>
                                                {att.file_size > 0 && (
                                                    <Text className="text-xs text-muted">
                                                        {(att.file_size / 1024).toFixed(0)} KB
                                                    </Text>
                                                )}
                                            </View>
                                            <IconSymbol name="arrow.down.circle.fill" size={20} color={colors.primary} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Related Articles */}
                            {related.length > 0 && (
                                <View className="mb-6">
                                    <Text className="text-sm font-semibold text-foreground mb-2">Verwandte Artikel</Text>
                                    {related.map((rel: any) => (
                                        <View
                                            key={rel.id}
                                            className="flex-row items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 mb-1"
                                        >
                                            <IconSymbol name="doc.text.fill" size={16} color={colors.muted} />
                                            <Text className="text-sm text-foreground flex-1" numberOfLines={1}>
                                                {rel.title}
                                            </Text>
                                            <Text className="text-xs text-muted">{rel.view_count || 0}×</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Spacer */}
                            <View style={{ height: 24 }} />
                        </ScrollView>

                        {/* Footer */}
                        <View className="p-4 border-t border-border flex-row gap-2">
                            <TouchableOpacity
                                className="bg-surface border border-border px-4 py-3 rounded-lg flex-row items-center gap-2"
                                onPress={() => togglePin.mutate()}
                                activeOpacity={0.8}
                            >
                                <IconSymbol
                                    name="pin.fill"
                                    size={14}
                                    color={article.is_pinned ? colors.primary : colors.muted}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-error/10 border border-error/30 px-4 py-3 rounded-lg"
                                onPress={handleDelete}
                                activeOpacity={0.8}
                            >
                                <IconSymbol name="trash.fill" size={14} color={colors.error} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-primary py-3 rounded-lg"
                                onPress={() => setShowEditModal(true)}
                                activeOpacity={0.8}
                            >
                                <Text className="font-semibold text-center" style={{ color: "#111" }}>
                                    Bearbeiten
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Modal */}
            <KbArticleFormModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                article={article}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["kb_article", article.id] });
                }}
            />
        </>
    );
}
