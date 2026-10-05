import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDateTime } from "@/lib/format";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { setAppBadge } from "@/lib/push-notifications";

export default function AdminNotificationsScreen() {
    const colors = useColors();
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.id) {
                setUserId(session.user.id);
            }
        });
    }, []);

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ["adminNotifications", userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId as string)
                .order("created_at", { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        },
        enabled: !!userId,
    });

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["adminNotifications"] });
            queryClient.invalidateQueries({ queryKey: ["unreadAdminNotifications"] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            if (!userId) return;
            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", userId)
                .eq("is_read", false);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["adminNotifications"] });
            queryClient.invalidateQueries({ queryKey: ["unreadAdminNotifications"] });
        },
    });

    const handleNotificationPress = (notification: any) => {
        if (!notification.is_read) {
            markAsReadMutation.mutate(notification.id);
        }
        if (notification.link) {
            router.push(notification.link as any);
        }
    };

    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    // App-Icon-Badge sofort nachführen, wenn hier gelesen/alle gelesen wird
    useEffect(() => {
        if (!isLoading) setAppBadge(unreadCount);
    }, [unreadCount, isLoading]);

    const displayedNotifications = showUnreadOnly
        ? notifications.filter((n: any) => !n.is_read)
        : notifications;

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
            style={{
                backgroundColor: item.is_read ? colors.background : colors.surface,
                borderColor: item.is_read ? colors.border : colors.primary,
                borderWidth: 1,
            }}
            className="p-4 rounded-xl mb-3"
        >
            <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                    <Text
                        style={{ color: item.is_read ? colors.muted : colors.foreground }}
                        className={`text-base mb-1 ${item.is_read ? "font-regular" : "font-bold"}`}
                    >
                        {item.title}
                    </Text>
                    <Text
                        style={{ color: item.is_read ? colors.muted : colors.foreground }}
                        className="text-sm"
                    >
                        {item.message}
                    </Text>
                    <Text style={{ color: colors.muted }} className="text-xs mt-2">
                        {formatDateTime(item.created_at)}
                    </Text>
                </View>
                {!item.is_read && (
                    <View style={{ backgroundColor: colors.primary }} className="w-3 h-3 rounded-full mt-1" />
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenContainer>
            {/* Header */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="mr-4">
                            <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
                        </TouchableOpacity>
                        <Text className="text-2xl font-bold text-foreground">Aktivitäten</Text>
                        {unreadCount > 0 && (
                            <View
                                style={{ backgroundColor: colors.primary }}
                                className="ml-2 rounded-full px-2 py-0.5"
                            >
                                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                                    {unreadCount}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Alle gelesen Button */}
                    {unreadCount > 0 && (
                        <TouchableOpacity
                            onPress={() => markAllAsReadMutation.mutate()}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: colors.surface,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                            }}
                        >
                            <IconSymbol name="checkmark.circle.fill" size={14} color={colors.primary} />
                            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                                Alle gelesen
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter-Chips */}
                <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
                    <TouchableOpacity
                        onPress={() => setShowUnreadOnly(false)}
                        activeOpacity={0.7}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: !showUnreadOnly ? colors.primary : colors.surface,
                            borderWidth: 1,
                            borderColor: !showUnreadOnly ? colors.primary : colors.border,
                        }}
                    >
                        <Text style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: !showUnreadOnly ? "#fff" : colors.foreground,
                        }}>
                            Alle ({notifications.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setShowUnreadOnly(true)}
                        activeOpacity={0.7}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: showUnreadOnly ? colors.primary : colors.surface,
                            borderWidth: 1,
                            borderColor: showUnreadOnly ? colors.primary : colors.border,
                        }}
                    >
                        <Text style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: showUnreadOnly ? "#fff" : colors.foreground,
                        }}>
                            Ungelesen ({unreadCount})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View className="flex-1 p-4">
                {isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : displayedNotifications.length > 0 ? (
                    <FlatList
                        data={displayedNotifications}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id.toString()}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <IconSymbol
                            name={showUnreadOnly ? "checkmark.circle.fill" : "bell.slash.fill"}
                            size={64}
                            color={colors.muted}
                        />
                        <Text className="text-xl font-bold text-foreground mt-6 mb-2">
                            {showUnreadOnly ? "Alles gelesen!" : "Alles erledigt!"}
                        </Text>
                        <Text className="text-base text-muted text-center max-w-[280px]">
                            {showUnreadOnly
                                ? "Sie haben keine ungelesenen Benachrichtigungen."
                                : "Sie haben derzeit keine Benachrichtigungen."}
                        </Text>
                    </View>
                )}
            </View>
        </ScreenContainer>
    );
}
