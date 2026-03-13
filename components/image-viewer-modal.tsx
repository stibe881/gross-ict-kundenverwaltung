import { Modal, View, Text, TouchableOpacity, Image, Platform, Linking, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import { WebView } from "react-native-webview";

interface ImageViewerModalProps {
    visible: boolean;
    onClose: () => void;
    url: string | null;
    title: string;
}

export function ImageViewerModal({ visible, onClose, url, title }: ImageViewerModalProps) {
    const colors = useColors();
    const [loading, setLoading] = useState(true);

    if (!url) return null;

    // Check if it's a PDF. Supabase URLs often don't have .pdf at the very end,
    // but we can check the mime type or extension if available, or just fallback
    // For now, check if URL contains .pdf
    const isPdf = url.toLowerCase().includes(".pdf");

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
                {/* Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: Platform.OS === "ios" ? 50 : 20,
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    zIndex: 10
                }}>
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                        {title}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 16 }}>
                        <TouchableOpacity onPress={() => Linking.openURL(url)}>
                            <IconSymbol name="safari" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onClose}>
                            <IconSymbol name="xmark" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    {loading && (
                        <ActivityIndicator 
                            size="large" 
                            color={colors.primary} 
                            style={{ position: "absolute", zIndex: 1 }} 
                        />
                    )}

                    {isPdf ? (
                        Platform.OS === 'web' ? (
                            <iframe 
                                src={url} 
                                style={{ width: '100%', height: '100%', border: 'none' }} 
                                onLoad={() => setLoading(false)}
                            />
                        ) : (
                            <WebView
                                source={{ uri: url }}
                                style={{ flex: 1, width: '100%', backgroundColor: 'transparent' }}
                                onLoad={() => setLoading(false)}
                                onError={() => setLoading(false)}
                            />
                        )
                    ) : (
                        <Image
                            source={{ uri: url }}
                            style={{ width: "100%", height: "100%", resizeMode: "contain" }}
                            onLoadStart={() => setLoading(true)}
                            onLoad={() => setLoading(false)}
                            onError={() => setLoading(false)}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
