import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatDateTime } from "@/lib/format";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export default function AdminNotificationsScreen() {
    const colors = useColors();
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);

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
                .eq("user_id", userId)
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

    const handleNotificationPress = (notification: any) => {
        if (!notification.is_read) {
            markAsReadMutation.mutate(notification.id);
        }
        if (notification.link) {
            router.push(notification.link as any);
        }
    };

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
            <View className="p-4 border-b border-border flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="mr-4">
                    <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-foreground">Aktivitäten</Text>
            </View>

            <View className="flex-1 p-4">
                {isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : notifications.length > 0 ? (
                    <FlatList
                        data={notifications}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id.toString()}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <IconSymbol name="bell.slash.fill" size={64} color={colors.muted} />
                        <Text className="text-xl font-bold text-foreground mt-6 mb-2">Alles erledigt!</Text>
                        <Text className="text-base text-muted text-center max-w-[280px]">
                            Sie haben derzeit keine Benachrichtigungen.
                        </Text>
                    </View>
                )}
            </View>
        </ScreenContainer>
    );
}
