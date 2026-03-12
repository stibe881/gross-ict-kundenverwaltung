import { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Switch,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    article?: any; // undefined = create, defined = edit
}

export function KbArticleFormModal({ visible, onClose, onSuccess, article }: Props) {
    const colors = useColors();
    const queryClient = useQueryClient();
    const isEdit = !!article;

    const [formData, setFormData] = useState({
        title: "",
        content: "",
        category_id: "",
        status: "draft" as string,
        tags: "",
        is_pinned: false,
    });
    const [showPreview, setShowPreview] = useState(false);

    const { data: categories = [] } = useQuery({
        queryKey: ["kb_categories"],
        queryFn: Data.getKbCategories,
    });

    useEffect(() => {
        if (visible) {
            if (article) {
                setFormData({
                    title: article.title || "",
                    content: article.content || "",
                    category_id: article.category_id || "",
                    status: article.status || "draft",
                    tags: (article.tags || []).join(", "),
                    is_pinned: article.is_pinned || false,
                });
            } else {
                setFormData({
                    title: "",
                    content: "",
                    category_id: "",
                    status: "draft",
                    tags: "",
                    is_pinned: false,
                });
            }
            setShowPreview(false);
        }
    }, [visible, article]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const tagsArr = formData.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);

            const payload = {
                title: formData.title.trim(),
                content: formData.content,
                category_id: formData.category_id || undefined,
                status: formData.status,
                tags: tagsArr,
                is_pinned: formData.is_pinned,
            };

            if (isEdit) {
                return Data.updateKbArticle(article.id, payload);
            } else {
                return Data.createKbArticle(payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kb_articles"] });
            showAlert("Erfolg", isEdit ? "Artikel aktualisiert" : "Artikel erstellt");
            onSuccess?.();
            onClose();
        },
        onError: (err: any) => {
            showAlert("Fehler", err.message);
        },
    });

    const isValid = formData.title.trim().length > 0;

    // Simple markdown-to-text renderer (strips markdown syntax for preview)
    const renderMarkdownPreview = (text: string) => {
        return text
            .replace(/^### (.+)$/gm, "──── $1 ────")
            .replace(/^## (.+)$/gm, "━━ $1 ━━")
            .replace(/^# (.+)$/gm, "▌ $1")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/`(.+?)`/g, "$1")
            .replace(/^- /gm, "  • ")
            .replace(/^\d+\. /gm, "  ")
            .replace(/^>/gm, "│ ");
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-background rounded-t-3xl" style={{ maxHeight: "95%" }}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-border">
                        <Text className="text-xl font-bold text-foreground">
                            {isEdit ? "Artikel bearbeiten" : "Neuer Artikel"}
                        </Text>
                        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                            <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                        <View className="gap-4">
                            {/* Titel */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-1">Titel *</Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-3 py-3 text-foreground"
                                    placeholder="Artikeltitel..."
                                    placeholderTextColor={colors.muted}
                                    value={formData.title}
                                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                                />
                            </View>

                            {/* Kategorie */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-1">Kategorie</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                                    <View className="flex-row gap-2">
                                        <TouchableOpacity
                                            className="px-3 py-2 rounded-lg"
                                            style={{
                                                backgroundColor: !formData.category_id ? colors.primary : colors.surface,
                                                borderWidth: !formData.category_id ? 0 : 1,
                                                borderColor: colors.border,
                                            }}
                                            onPress={() => setFormData({ ...formData, category_id: "" })}
                                        >
                                            <Text
                                                className="text-xs font-semibold"
                                                style={{ color: !formData.category_id ? "#111" : colors.foreground }}
                                            >
                                                Keine
                                            </Text>
                                        </TouchableOpacity>
                                        {categories.map((cat: any) => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                className="px-3 py-2 rounded-lg"
                                                style={{
                                                    backgroundColor: formData.category_id === cat.id ? cat.color || colors.primary : colors.surface,
                                                    borderWidth: formData.category_id === cat.id ? 0 : 1,
                                                    borderColor: colors.border,
                                                }}
                                                onPress={() => setFormData({ ...formData, category_id: cat.id })}
                                            >
                                                <Text
                                                    className="text-xs font-semibold"
                                                    style={{ color: formData.category_id === cat.id ? "#FFF" : colors.foreground }}
                                                >
                                                    {cat.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            {/* Inhalt mit Vorschau-Toggle */}
                            <View>
                                <View className="flex-row items-center justify-between mb-1">
                                    <Text className="text-sm font-semibold text-foreground">Inhalt (Markdown)</Text>
                                    <TouchableOpacity
                                        className="flex-row items-center gap-1 px-2 py-1 rounded-md"
                                        style={{ backgroundColor: showPreview ? colors.primary + "20" : colors.surface }}
                                        onPress={() => setShowPreview(!showPreview)}
                                        activeOpacity={0.7}
                                    >
                                        <IconSymbol
                                            name={showPreview ? "doc.text" : "eye.fill"}
                                            size={14}
                                            color={showPreview ? colors.primary : colors.muted}
                                        />
                                        <Text
                                            className="text-xs font-semibold"
                                            style={{ color: showPreview ? colors.primary : colors.muted }}
                                        >
                                            {showPreview ? "Bearbeiten" : "Vorschau"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {showPreview ? (
                                    <View
                                        className="bg-surface border border-border rounded-lg p-4"
                                        style={{ minHeight: 200 }}
                                    >
                                        <Text className="text-foreground text-sm" style={{ lineHeight: 22 }}>
                                            {formData.content ? renderMarkdownPreview(formData.content) : "Noch kein Inhalt..."}
                                        </Text>
                                    </View>
                                ) : (
                                    <TextInput
                                        className="bg-surface border border-border rounded-lg px-3 py-3 text-foreground text-sm"
                                        placeholder="Artikel-Inhalt in Markdown schreiben..."
                                        placeholderTextColor={colors.muted}
                                        value={formData.content}
                                        onChangeText={(text) => setFormData({ ...formData, content: text })}
                                        multiline
                                        numberOfLines={10}
                                        textAlignVertical="top"
                                        style={{ minHeight: 200 }}
                                    />
                                )}
                            </View>

                            {/* Tags */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-1">Tags (kommagetrennt)</Text>
                                <TextInput
                                    className="bg-surface border border-border rounded-lg px-3 py-3 text-foreground"
                                    placeholder="z.B. Windows, Netzwerk, VPN"
                                    placeholderTextColor={colors.muted}
                                    value={formData.tags}
                                    onChangeText={(text) => setFormData({ ...formData, tags: text })}
                                />
                                {formData.tags.trim() && (
                                    <View className="flex-row flex-wrap gap-1 mt-2">
                                        {formData.tags.split(",").map((tag, i) =>
                                            tag.trim() ? (
                                                <View
                                                    key={i}
                                                    className="px-2 py-0.5 rounded-full"
                                                    style={{ backgroundColor: colors.primary + "20" }}
                                                >
                                                    <Text className="text-xs" style={{ color: colors.primary }}>
                                                        {tag.trim()}
                                                    </Text>
                                                </View>
                                            ) : null
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Status */}
                            <View>
                                <Text className="text-sm font-semibold text-foreground mb-1">Status</Text>
                                <View className="flex-row gap-2">
                                    {[
                                        { key: "draft", label: "Entwurf", color: colors.warning },
                                        { key: "published", label: "Veröffentlicht", color: colors.success },
                                        { key: "archived", label: "Archiviert", color: colors.muted },
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.key}
                                            className="px-3 py-2 rounded-lg"
                                            style={{
                                                backgroundColor: formData.status === opt.key ? opt.color : opt.color + "15",
                                                borderWidth: formData.status === opt.key ? 0 : 1,
                                                borderColor: formData.status === opt.key ? "transparent" : opt.color + "40",
                                            }}
                                            onPress={() => setFormData({ ...formData, status: opt.key })}
                                        >
                                            <Text
                                                className="text-xs font-semibold"
                                                style={{ color: formData.status === opt.key ? "#FFF" : opt.color }}
                                            >
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Pinned */}
                            <View className="flex-row items-center justify-between bg-surface border border-border rounded-lg px-3 py-3">
                                <View className="flex-row items-center gap-2">
                                    <IconSymbol name="pin.fill" size={16} color={formData.is_pinned ? colors.primary : colors.muted} />
                                    <Text className="text-sm font-semibold text-foreground">Angepinnt</Text>
                                </View>
                                <Switch
                                    value={formData.is_pinned}
                                    onValueChange={(val) => setFormData({ ...formData, is_pinned: val })}
                                    trackColor={{ false: colors.border, true: colors.primary }}
                                    thumbColor="#FFF"
                                />
                            </View>
                        </View>

                        {/* Spacer */}
                        <View style={{ height: 24 }} />
                    </ScrollView>

                    {/* Footer */}
                    <View className="p-4 border-t border-border flex-row gap-3">
                        <TouchableOpacity
                            className="flex-1 bg-surface border border-border py-3 rounded-lg"
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <Text className="text-foreground font-semibold text-center">Abbrechen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-primary py-3 rounded-lg items-center"
                            onPress={() => saveMutation.mutate()}
                            activeOpacity={0.8}
                            disabled={!isValid || saveMutation.isPending}
                            style={{ opacity: !isValid || saveMutation.isPending ? 0.5 : 1 }}
                        >
                            {saveMutation.isPending ? (
                                <ActivityIndicator color="#111" size="small" />
                            ) : (
                                <Text
                                    className="font-semibold text-center"
                                    style={{ color: "#111" }}
                                >
                                    {isEdit ? "Speichern" : "Erstellen"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
