import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";
import { showAlert } from "@/lib/alert";

// Date format helpers: display DD.MM.YYYY <-> storage YYYY-MM-DD
const isoToDisplay = (iso: string) => {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
};
const displayToIso = (display: string) => {
    if (!display) return "";
    const parts = display.split(".");
    if (parts.length !== 3) return display;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

interface Props {
    visible: boolean;
    project?: any;
    onClose: () => void;
    onSuccess: () => void;
}

type ProjectTemplate = {
    key: string;
    label: string;
    icon: string;
    description: string;
    budget: string;
    milestones: { title: string; description: string; dayOffset: number }[];
};

const PROJECT_TEMPLATES: ProjectTemplate[] = [
    {
        key: "website",
        label: "Website",
        icon: "globe",
        description: "Erstellung einer professionellen Website",
        budget: "3500",
        milestones: [
            { title: "Kickoff & Briefing", description: "Anforderungen besprechen, Zielgruppe und Inhalte definieren", dayOffset: 0 },
            { title: "Konzept & Wireframes", description: "Seitenstruktur, Navigation und Wireframes erstellen", dayOffset: 7 },
            { title: "Design-Entwurf", description: "Visuelles Design erstellen und abstimmen", dayOffset: 14 },
            { title: "Development", description: "Website programmieren und CMS einrichten", dayOffset: 21 },
            { title: "Inhalte einpflegen", description: "Texte, Bilder und Medien einpflegen", dayOffset: 35 },
            { title: "Testing & QA", description: "Browser-Tests, Mobile-Check, Performance-Optimierung", dayOffset: 42 },
            { title: "Go-Live", description: "Website veröffentlichen, DNS konfigurieren, SSL einrichten", dayOffset: 49 },
        ],
    },
    {
        key: "website_shop",
        label: "Website + Onlineshop",
        icon: "cart",
        description: "Website mit integriertem Onlineshop",
        budget: "8500",
        milestones: [
            { title: "Kickoff & Briefing", description: "Anforderungen, Produktkatalog und Zahlungsmethoden besprechen", dayOffset: 0 },
            { title: "Konzept & Wireframes", description: "Shop-Struktur, Kategorien und User-Flow definieren", dayOffset: 7 },
            { title: "Design-Entwurf", description: "Shop-Design, Produktseiten und Checkout gestalten", dayOffset: 14 },
            { title: "Frontend Development", description: "Website und Shop-Oberfläche programmieren", dayOffset: 21 },
            { title: "Shop-Integration", description: "Zahlungs-Gateway, Versand und Warenwirtschaft anbinden", dayOffset: 35 },
            { title: "Produkte einpflegen", description: "Artikel, Beschreibungen, Bilder und Preise erfassen", dayOffset: 49 },
            { title: "Testing & QA", description: "Bestellprozess testen, Mobile-Check, Security-Audit", dayOffset: 56 },
            { title: "Soft-Launch", description: "Shop im Testbetrieb mit ausgewählten Kunden starten", dayOffset: 63 },
            { title: "Go-Live", description: "Offizieller Launch, Marketing und Monitoring", dayOffset: 70 },
        ],
    },
];

export function ProjectFormModal({ visible, project, onClose, onSuccess }: Props) {
    const colors = useColors();
    const [saving, setSaving] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [customerId, setCustomerId] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [budget, setBudget] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("planning");
    const [priority, setPriority] = useState("medium");
    const [notes, setNotes] = useState("");

    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: Data.getCustomersWithCounts,
    });

    const getCustomerName = (c: any) =>
        c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "-";

    const selectedCustomer = (customers || []).find((c: any) => c.id === customerId);

    const filteredCustomers = (customers || []).filter((c: any) => {
        if (!customerSearch.trim()) return true;
        const term = customerSearch.toLowerCase();
        const name = getCustomerName(c).toLowerCase();
        const email = (c.email || "").toLowerCase();
        return name.includes(term) || email.includes(term);
    });

    useEffect(() => {
        if (project) {
            setTitle(project.title || "");
            setDescription(project.description || "");
            setCustomerId(project.customer_id || "");
            setBudget(project.budget?.toString() || "");
            setStartDate(isoToDisplay(project.start_date || ""));
            setEndDate(isoToDisplay(project.end_date || ""));
            setStatus(project.status || "planning");
            setPriority(project.priority || "medium");
            setNotes(project.notes || "");
            const cust = (customers || []).find((c: any) => c.id === project.customer_id);
            if (cust) setCustomerSearch(getCustomerName(cust));
        } else {
            setSelectedTemplate(null);
            setTitle("");
            setDescription("");
            setCustomerId("");
            setCustomerSearch("");
            setBudget("");
            const today = new Date();
            setStartDate(`${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`);
            setEndDate("");
            setStatus("planning");
            setPriority("medium");
            setNotes("");
        }
        setShowCustomerDropdown(false);
    }, [project, visible]);

    const handleSave = async () => {
        if (!title.trim()) {
            showAlert("Fehler", "Bitte geben Sie einen Titel ein.");
            return;
        }
        if (!customerId) {
            showAlert("Fehler", "Bitte wählen Sie einen Kunden aus.");
            return;
        }

        setSaving(true);
        try {
            const data = {
                title: title.trim(),
                description: description.trim(),
                customer_id: customerId,
                budget: parseFloat(budget) || 0,
                start_date: displayToIso(startDate) || null,
                end_date: displayToIso(endDate) || null,
                status,
                priority,
                notes: notes.trim() || null,
            };

            if (project) {
                await Data.updateProject(project.id, data);
            } else {
                const newProject = await Data.createProject(data);

                // Meilensteine aus Vorlage erstellen
                const tmpl = PROJECT_TEMPLATES.find((t) => t.key === selectedTemplate);
                if (tmpl && newProject?.id && startDate) {
                    const base = new Date(displayToIso(startDate));
                    for (let i = 0; i < tmpl.milestones.length; i++) {
                        const m = tmpl.milestones[i];
                        const dueDate = new Date(base);
                        dueDate.setDate(dueDate.getDate() + m.dayOffset);
                        await Data.createMilestone({
                            project_id: newProject.id,
                            title: m.title,
                            description: m.description,
                            due_date: dueDate.toISOString().split("T")[0],
                            status: "pending",
                            sort_order: i,
                        });
                    }
                }
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            showAlert("Fehler", error.message);
        } finally {
            setSaving(false);
        }
    };

    const statuses = [
        { key: "planning", label: "Planung", color: "#6B7280" },
        { key: "in_progress", label: "In Arbeit", color: "#3B82F6" },
        { key: "completed", label: "Abgeschlossen", color: "#10B981" },
        { key: "cancelled", label: "Abgebrochen", color: "#EF4444" },
    ];

    const priorities = [
        { key: "low", label: "Niedrig", color: "#6B7280" },
        { key: "medium", label: "Mittel", color: "#F59E0B" },
        { key: "high", label: "Hoch", color: "#EF4444" },
        { key: "urgent", label: "Dringend", color: "#DC2626" },
    ];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: colors.background }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                {/* Header */}
                <View
                    className="flex-row justify-between items-center p-4 border-b"
                    style={{ borderColor: colors.border }}
                >
                    <TouchableOpacity onPress={onClose}>
                        <Text style={{ color: colors.primary, fontSize: 16 }}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-foreground">
                        {project ? "Projekt bearbeiten" : "Neues Projekt"}
                    </Text>
                    <TouchableOpacity onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : (
                            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
                                Speichern
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView
                    className="flex-1 p-4"
                    contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Vorlagen (nur bei neuem Projekt) */}
                    {!project && (
                        <View>
                            <Text className="text-sm font-semibold text-foreground mb-2">Vorlage verwenden</Text>
                            <View className="flex-row gap-3">
                                {PROJECT_TEMPLATES.map((tmpl) => {
                                    const isActive = selectedTemplate === tmpl.key;
                                    return (
                                        <TouchableOpacity
                                            key={tmpl.key}
                                            className="flex-1 rounded-xl p-3 border"
                                            style={{
                                                backgroundColor: isActive ? colors.primary + '15' : colors.surface,
                                                borderColor: isActive ? colors.primary : colors.border,
                                            }}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                if (selectedTemplate === tmpl.key) {
                                                    setSelectedTemplate(null);
                                                } else {
                                                    setSelectedTemplate(tmpl.key);
                                                    setTitle(tmpl.label);
                                                    setDescription(tmpl.description);
                                                    setBudget(tmpl.budget);
                                                    // End date from last milestone
                                                    const lastMs = tmpl.milestones[tmpl.milestones.length - 1];
                                                    if (startDate && lastMs) {
                                                        const end = new Date(displayToIso(startDate));
                                                        end.setDate(end.getDate() + lastMs.dayOffset);
                                                        setEndDate(isoToDisplay(end.toISOString().split('T')[0]));
                                                    }
                                                }
                                            }}
                                        >
                                            <View className="items-center gap-2">
                                                <IconSymbol name={tmpl.icon as any} size={24} color={isActive ? colors.primary : colors.muted} />
                                                <Text className="text-sm font-semibold text-center" style={{ color: isActive ? colors.primary : colors.foreground }}>
                                                    {tmpl.label}
                                                </Text>
                                                <Text className="text-xs text-center" style={{ color: colors.muted }} numberOfLines={2}>
                                                    {tmpl.milestones.length} Meilensteine
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            {selectedTemplate && (
                                <View className="mt-3 rounded-lg p-3" style={{ backgroundColor: colors.primary + '08', borderWidth: 1, borderColor: colors.primary + '20' }}>
                                    <Text className="text-xs font-semibold mb-1" style={{ color: colors.primary }}>Timeline-Vorschau</Text>
                                    {PROJECT_TEMPLATES.find(t => t.key === selectedTemplate)?.milestones.map((m, i) => {
                                        let dateStr = '';
                                        if (startDate) {
                                            const d = new Date(displayToIso(startDate));
                                            d.setDate(d.getDate() + m.dayOffset);
                                            dateStr = d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                        }
                                        return (
                                            <View key={i} className="flex-row items-center gap-2 py-1">
                                                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} />
                                                <Text className="text-xs flex-1" style={{ color: colors.foreground }}>{m.title}</Text>
                                                {dateStr ? <Text className="text-xs" style={{ color: colors.muted }}>{dateStr}</Text> : null}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Titel */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Titel *</Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Projekttitel"
                            placeholderTextColor={colors.muted}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>

                    {/* Beschreibung */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Beschreibung</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Projektbeschreibung"
                            placeholderTextColor={colors.muted}
                            multiline
                            numberOfLines={3}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                                textAlignVertical: "top",
                                minHeight: 80,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>

                    {/* Kunde - Autocomplete Dropdown */}
                    <View style={{ zIndex: 10 }}>
                        <Text className="text-sm font-semibold text-foreground mb-2">Kunde *</Text>
                        <View
                            className="flex-row items-center rounded-lg border"
                            style={{
                                backgroundColor: colors.surface,
                                borderColor: customerId ? colors.primary : colors.border,
                            }}
                        >
                            <IconSymbol
                                name="magnifyingglass"
                                size={16}
                                color={colors.muted}
                                style={{ marginLeft: 12 }}
                            />
                            <TextInput
                                value={customerSearch}
                                onChangeText={(text) => {
                                    setCustomerSearch(text);
                                    setShowCustomerDropdown(true);
                                    if (!text.trim()) setCustomerId("");
                                }}
                                onFocus={() => setShowCustomerDropdown(true)}
                                placeholder="Kunde suchen..."
                                placeholderTextColor={colors.muted}
                                style={{
                                    flex: 1,
                                    color: colors.foreground,
                                    paddingVertical: 12,
                                    paddingHorizontal: 8,
                                    fontSize: 14,
                                }}
                            />
                            {customerId ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomerId("");
                                        setCustomerSearch("");
                                        setShowCustomerDropdown(true);
                                    }}
                                    style={{ paddingRight: 12 }}
                                >
                                    <IconSymbol name="xmark.circle.fill" size={18} color={colors.muted} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Dropdown */}
                        {showCustomerDropdown && !customerId && (
                            <View
                                className="rounded-lg border mt-1"
                                style={{
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                    maxHeight: 180,
                                }}
                            >
                                <ScrollView
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator
                                >
                                    {filteredCustomers.length > 0 ? (
                                        filteredCustomers.slice(0, 20).map((c: any) => {
                                            const name = getCustomerName(c);
                                            return (
                                                <TouchableOpacity
                                                    key={c.id}
                                                    className="px-3 py-2.5 border-b"
                                                    style={{ borderColor: colors.border + "40" }}
                                                    activeOpacity={0.6}
                                                    onPress={() => {
                                                        setCustomerId(c.id);
                                                        setCustomerSearch(name);
                                                        setShowCustomerDropdown(false);
                                                    }}
                                                >
                                                    <Text
                                                        className="text-sm font-semibold"
                                                        style={{ color: colors.foreground }}
                                                        numberOfLines={1}
                                                    >
                                                        {name}
                                                    </Text>
                                                    {c.email && (
                                                        <Text
                                                            className="text-xs"
                                                            style={{ color: colors.muted }}
                                                            numberOfLines={1}
                                                        >
                                                            {c.email}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })
                                    ) : (
                                        <View className="px-3 py-3">
                                            <Text className="text-sm text-muted text-center">
                                                Kein Kunde gefunden
                                            </Text>
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
                        )}

                        {/* Selected Customer Badge */}
                        {selectedCustomer && (
                            <View
                                className="flex-row items-center gap-2 mt-2 px-3 py-2 rounded-lg"
                                style={{ backgroundColor: colors.primary + "15" }}
                            >
                                <IconSymbol name="checkmark" size={14} color={colors.primary} />
                                <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                                    {getCustomerName(selectedCustomer)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Status */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Status</Text>
                        <View className="flex-row gap-2 flex-wrap">
                            {statuses.map((s) => (
                                <TouchableOpacity
                                    key={s.key}
                                    onPress={() => setStatus(s.key)}
                                    style={{
                                        backgroundColor: status === s.key ? s.color : colors.surface,
                                        borderColor: status === s.key ? s.color : colors.border,
                                    }}
                                    className="px-3 py-1.5 rounded-full border"
                                >
                                    <Text
                                        style={{
                                            color: status === s.key ? "#fff" : colors.foreground,
                                            fontSize: 13,
                                            fontWeight: "600",
                                        }}
                                    >
                                        {s.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Budget */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Budget (CHF)</Text>
                        <TextInput
                            value={budget}
                            onChangeText={setBudget}
                            placeholder="0.00"
                            placeholderTextColor={colors.muted}
                            keyboardType="decimal-pad"
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>

                    {/* Datum */}
                    <View className="flex-row gap-4">
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-foreground mb-2">Startdatum</Text>
                            <TextInput
                                value={startDate}
                                onChangeText={setStartDate}
                                placeholder="DD.MM.YYYY"
                                placeholderTextColor={colors.muted}
                                style={{
                                    backgroundColor: colors.surface,
                                    color: colors.foreground,
                                    borderColor: colors.border,
                                }}
                                className="p-3 rounded-lg border text-base"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-semibold text-foreground mb-2">Enddatum</Text>
                            <TextInput
                                value={endDate}
                                onChangeText={setEndDate}
                                placeholder="DD.MM.YYYY"
                                placeholderTextColor={colors.muted}
                                style={{
                                    backgroundColor: colors.surface,
                                    color: colors.foreground,
                                    borderColor: colors.border,
                                }}
                                className="p-3 rounded-lg border text-base"
                            />
                        </View>
                    </View>

                    {/* Priorität */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Priorität</Text>
                        <View className="flex-row gap-2 flex-wrap">
                            {priorities.map((p) => (
                                <TouchableOpacity
                                    key={p.key}
                                    onPress={() => setPriority(p.key)}
                                    style={{
                                        backgroundColor: priority === p.key ? p.color : colors.surface,
                                        borderColor: priority === p.key ? p.color : colors.border,
                                    }}
                                    className="px-3 py-1.5 rounded-full border"
                                >
                                    <Text
                                        style={{
                                            color: priority === p.key ? "#fff" : colors.foreground,
                                            fontSize: 13,
                                            fontWeight: "600",
                                        }}
                                    >
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Notizen */}
                    <View>
                        <Text className="text-sm font-semibold text-foreground mb-2">Notizen</Text>
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Interne Notizen zum Projekt..."
                            placeholderTextColor={colors.muted}
                            multiline
                            numberOfLines={3}
                            style={{
                                backgroundColor: colors.surface,
                                color: colors.foreground,
                                borderColor: colors.border,
                                textAlignVertical: "top",
                                minHeight: 80,
                            }}
                            className="p-3 rounded-lg border text-base"
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}
