import { ScrollView, Text, View, TouchableOpacity, Image } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase";
import * as Data from "@/lib/data";

// Seitenleiste für die Desktop-Webansicht (ersetzt dort die untere Tab-Leiste).
// Mobil im Browser und in den nativen Apps bleibt die Tab-Navigation bestehen.

interface NavItem {
    route: string;
    label: string;
    icon: any;
    badge?: number;
    badgeColor?: string;
    neverActive?: boolean;
}

interface NavSection {
    label: string;
    items: NavItem[];
}

export function WebSidebar() {
    const colors = useColors();
    const router = useRouter();
    const pathname = usePathname();

    const { data: sessionData } = useQuery({
        queryKey: ["currentSession"],
        queryFn: async () => {
            const { data } = await supabase.auth.getSession();
            return data.session;
        },
    });

    const { data: userProfile } = useQuery({
        queryKey: ["userProfile", sessionData?.user?.id],
        queryFn: () => Data.getUserProfile(sessionData?.user?.id as string),
        enabled: !!sessionData?.user?.id,
    });

    const roles: string[] = userProfile?.roles || [];
    const isAdmin = roles.includes("admin");
    const showCustomers = isAdmin || roles.includes("administration");
    const showAccounting = isAdmin || roles.includes("finanzen");
    const showTickets = isAdmin || roles.includes("technik");
    const showProjects = isAdmin || roles.includes("administration") || roles.includes("technik") || roles.includes("finanzen");

    // Badge: offene Tickets
    const { data: openTickets = 0 } = useQuery({
        queryKey: ["sidebarOpenTickets"],
        queryFn: async () => {
            const { count } = await supabase
                .from("tickets")
                .select("*", { count: "exact", head: true })
                .in("status", ["open", "in_progress"]);
            return count || 0;
        },
        refetchInterval: 60000,
        enabled: showTickets,
    });

    const userName =
        sessionData?.user?.user_metadata?.full_name ||
        sessionData?.user?.user_metadata?.name ||
        sessionData?.user?.email?.split("@")[0] ||
        "Benutzer";

    const sections: NavSection[] = [
        {
            label: "Überblick",
            items: [{ route: "/", label: "Dashboard", icon: "house.fill" }],
        },
        {
            label: "CRM",
            items: [
                ...(showCustomers ? [{ route: "/customers", label: "Kunden", icon: "person.2.fill" }] : []),
                { route: "/leads", label: "Akquise", icon: "flag.fill" },
                { route: "/quotes", label: "Angebote", icon: "doc.on.doc.fill" },
                ...(showProjects ? [{ route: "/projects", label: "Projekte", icon: "folder.fill" }] : []),
            ],
        },
        {
            label: "Betrieb",
            items: [
                ...(showTickets ? [{ route: "/tickets", label: "Tickets", icon: "ticket.fill", badge: openTickets, badgeColor: "#FB923C" }] : []),
                { route: "/contracts", label: "Verträge", icon: "doc.text.fill" },
                { route: "/tasks", label: "Aufgaben", icon: "checklist" },
                { route: "/uberwachung", label: "Überwachung", icon: "wifi" },
                { route: "/knowledge-base", label: "Wissensdatenbank", icon: "book.fill" },
            ],
        },
        ...(showAccounting
            ? [{
                label: "Finanzen",
                items: [{ route: "/accounting", label: "Buchhaltung", icon: "chart.bar.fill" }],
            }]
            : []),
    ];

    const isActive = (route: string) =>
        route === "/" ? pathname === "/" || pathname === "/index" : pathname.startsWith(route);

    return (
        <View
            style={{
                width: 232,
                backgroundColor: colors.surface,
                borderRightWidth: 1,
                borderRightColor: colors.border,
            }}
        >
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 12, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
                {/* Logo */}
                <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingBottom: 18 }}
                    onPress={() => router.push("/" as any)}
                    activeOpacity={0.7}
                >
                    <Image
                        source={require("@/assets/images/icon.png")}
                        style={{ width: 34, height: 34, borderRadius: 9 }}
                        resizeMode="contain"
                    />
                    <View>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, lineHeight: 16 }}>Gross ICT</Text>
                        <Text style={{ fontSize: 11, color: colors.muted }}>Kundenverwaltung</Text>
                    </View>
                </TouchableOpacity>

                {/* Navigation */}
                {sections.map((section) =>
                    section.items.length === 0 ? null : (
                        <View key={section.label} style={{ marginBottom: 10 }}>
                            <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    letterSpacing: 1.4,
                                    color: colors.muted,
                                    textTransform: "uppercase",
                                    paddingHorizontal: 10,
                                    paddingBottom: 4,
                                }}
                            >
                                {section.label}
                            </Text>
                            {section.items.map((item) => {
                                const active = !item.neverActive && isActive(item.route);
                                return (
                                    <TouchableOpacity
                                        key={item.label}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 10,
                                            paddingVertical: 9,
                                            paddingHorizontal: 10,
                                            borderRadius: 9,
                                            backgroundColor: active ? colors.primary + "1C" : "transparent",
                                            marginBottom: 1,
                                        }}
                                        onPress={() => router.push(item.route as any)}
                                        activeOpacity={0.7}
                                    >
                                        <IconSymbol name={item.icon} size={16} color={active ? colors.primary : colors.muted} />
                                        <Text
                                            style={{
                                                flex: 1,
                                                fontSize: 13.5,
                                                fontWeight: active ? "700" : "500",
                                                color: active ? colors.primary : colors.foreground,
                                            }}
                                        >
                                            {item.label}
                                        </Text>
                                        {item.badge ? (
                                            <View style={{ backgroundColor: (item.badgeColor || colors.primary) + "25", borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1 }}>
                                                <Text style={{ fontSize: 11, fontWeight: "700", color: item.badgeColor || colors.primary }}>{item.badge}</Text>
                                            </View>
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )
                )}

                {/* Profil unten */}
                <View style={{ marginTop: "auto", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                    <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 }}
                        onPress={() => router.push("/settings" as any)}
                        activeOpacity={0.7}
                    >
                        <View>
                            {(userProfile as any)?.avatar_url ? (
                                <Image source={{ uri: (userProfile as any).avatar_url }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                            ) : (
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.background }}>
                                    {userName.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            )}
                            <View style={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: "#4ADE80", borderWidth: 2, borderColor: colors.surface }} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{userName}</Text>
                            <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>
                                {isAdmin ? "Admin · online" : "online"}
                            </Text>
                        </View>
                        <IconSymbol name="gear" size={16} color={colors.muted} />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
