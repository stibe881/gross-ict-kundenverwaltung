import { useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { supabase } from "@/lib/supabase";
import * as Data from "@/lib/data";
import { performGlobalSearch, GlobalSearchResult } from "@/lib/global-search";
import { AskCrmModal } from "@/components/ask-crm-modal";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { TicketFormModal } from "@/components/ticket-form-modal";
import { InvoiceFormModal } from "@/components/invoice-form-modal-v2";
import { QuoteFormModal } from "@/components/quote-form-modal";
import { ProjectFormModal } from "@/components/project-form-modal";

// Globale Kopfleiste der Desktop-Webansicht: Suche, "Frag dein CRM",
// Benachrichtigungen und das "Neu"-Menü – auf jeder Seite verfügbar.
export function WebTopbar() {
    const colors = useColors();
    const router = useRouter();

    const [search, setSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<GlobalSearchResult[]>([]);
    const searchTimer = useRef<any>(null);

    const [showAskCrm, setShowAskCrm] = useState(false);
    const [showNewMenu, setShowNewMenu] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);

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

    const allowedTileIds = Data.getAllowedTileIds(userProfile?.roles || []);
    const tileAllowed = (id: string) => !allowedTileIds || allowedTileIds.includes(id);

    const { data: unreadCount = 0 } = useQuery({
        queryKey: ["unreadAdminNotifications", sessionData?.user?.id],
        queryFn: async () => {
            const { count, error } = await supabase
                .from("notifications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", sessionData!.user.id)
                .eq("is_read", false);
            if (error) throw new Error(error.message);
            return count || 0;
        },
        enabled: !!sessionData?.user?.id,
        refetchInterval: 30000,
    });

    const handleSearchChange = (text: string) => {
        setSearch(text);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!text || text.length < 2) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        searchTimer.current = setTimeout(async () => {
            const r = await performGlobalSearch(text, colors);
            setResults(r);
            setSearching(false);
        }, 350);
    };

    const newMenuItems = [
        { id: "tickets", label: "Neues Ticket", icon: "ticket.fill", open: () => setShowTicketModal(true) },
        { id: "accounting", label: "Neue Rechnung", icon: "doc.text.fill", open: () => setShowInvoiceModal(true) },
        { id: "quotes", label: "Neues Angebot", icon: "doc.on.doc.fill", open: () => setShowQuoteModal(true) },
        { id: "customers", label: "Neuer Kunde", icon: "person.2.fill", open: () => setShowCustomerModal(true) },
        { id: "projects", label: "Neues Projekt", icon: "folder.fill", open: () => setShowProjectModal(true) },
    ].filter((m) => tileAllowed(m.id));

    return (
        <View style={{ zIndex: 100 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 28, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background }}>
                {/* Suche */}
                <View style={{ flex: 1, position: "relative" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: search ? colors.primary + "60" : colors.border, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 }}>
                        <IconSymbol name="magnifyingglass" size={15} color={colors.muted} />
                        <TextInput
                            style={{ flex: 1, fontSize: 13.5, color: colors.foreground }}
                            placeholder="Suchen… (status:offen · kunde:müller · >1000)"
                            placeholderTextColor={colors.muted}
                            value={search}
                            onChangeText={handleSearchChange}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearch(""); setResults([]); }}>
                                <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
                            </TouchableOpacity>
                        )}
                    </View>
                    {(results.length > 0 || (searching && search.length >= 2)) && (
                        <View style={{
                            position: "absolute", top: 44, left: 0, right: 0,
                            backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                            overflow: "hidden", maxHeight: 350,
                            ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.25)" } as any : {}),
                        }}>
                            {searching ? (
                                <View style={{ padding: 18, alignItems: "center" }}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            ) : (
                                <ScrollView style={{ maxHeight: 340 }} nestedScrollEnabled>
                                    {results.map((result, idx) => (
                                        <TouchableOpacity
                                            key={`${result.type}-${result.id}`}
                                            style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 11, borderBottomWidth: idx < results.length - 1 ? 1 : 0, borderBottomColor: colors.border + "60" }}
                                            activeOpacity={0.7}
                                            onPress={() => { setSearch(""); setResults([]); router.push(result.route as any); }}
                                        >
                                            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: result.color + "18", alignItems: "center", justifyContent: "center" }}>
                                                <IconSymbol name={result.icon as any} size={15} color={result.color} />
                                            </View>
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{result.title}</Text>
                                                <Text style={{ fontSize: 11.5, color: colors.muted }} numberOfLines={1}>{result.subtitle}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    )}
                </View>

                {/* Frag dein CRM */}
                <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#8B5CF61A", borderWidth: 1, borderColor: "#8B5CF645", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 }}
                    onPress={() => setShowAskCrm(true)}
                    activeOpacity={0.8}
                >
                    <IconSymbol name="sparkles" size={14} color="#B99CFF" />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#B99CFF" }}>Frag dein CRM</Text>
                </TouchableOpacity>

                {/* Benachrichtigungen */}
                <TouchableOpacity
                    style={{ position: "relative", width: 38, height: 38, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
                    onPress={() => router.push("/admin-notifications" as any)}
                    activeOpacity={0.7}
                >
                    <IconSymbol name="bell.fill" size={16} color={colors.foreground} />
                    {unreadCount > 0 && (
                        <View style={{ position: "absolute", top: -5, right: -5, backgroundColor: colors.error, borderRadius: 99, minWidth: 17, height: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFF" }}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Neu-Menü */}
                <View style={{ position: "relative" }}>
                    <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 11 }}
                        onPress={() => setShowNewMenu(!showNewMenu)}
                        activeOpacity={0.8}
                    >
                        <IconSymbol name="plus" size={14} color={colors.background} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.background }}>Neu</Text>
                    </TouchableOpacity>
                    {showNewMenu && (
                        <View style={{
                            position: "absolute", top: 44, right: 0, width: 200,
                            backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden",
                            ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.25)" } as any : {}),
                        }}>
                            {newMenuItems.map((m, idx) => (
                                <TouchableOpacity
                                    key={m.label}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: idx < newMenuItems.length - 1 ? 1 : 0, borderBottomColor: colors.border + "60" }}
                                    onPress={() => { setShowNewMenu(false); m.open(); }}
                                    activeOpacity={0.7}
                                >
                                    <IconSymbol name={m.icon as any} size={14} color={colors.primary} />
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>{m.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </View>

            {/* Modals */}
            <CustomerFormModal visible={showCustomerModal} onClose={() => setShowCustomerModal(false)} onSuccess={() => { }} />
            <TicketFormModal visible={showTicketModal} onClose={() => setShowTicketModal(false)} onSuccess={() => { }} />
            <InvoiceFormModal visible={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} onSuccess={() => { }} />
            <QuoteFormModal visible={showQuoteModal} onClose={() => setShowQuoteModal(false)} onSuccess={() => { }} />
            <ProjectFormModal visible={showProjectModal} onClose={() => setShowProjectModal(false)} onSuccess={() => { }} />
            <AskCrmModal visible={showAskCrm} onClose={() => setShowAskCrm(false)} colors={colors} />
        </View>
    );
}
