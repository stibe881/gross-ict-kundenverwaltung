import { useState } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency } from "@/lib/format";
import { showAlert } from "@/lib/alert";
import { useQuery } from "@tanstack/react-query";
import * as Data from "@/lib/data";

export interface ScenarioBookingModalProps {
    visible: boolean;
    amount: number;
    projectVol: number;
    onClose: () => void;
    onSubmit: (data: { 
        freelancerName: string; 
        freelancerAddress: string; 
        freelancerIban: string;
        customerId: string;
        projectId: string;
        customerName: string;
        projectName: string;
    }) => Promise<void>;
}

export function ScenarioBookingModal({ visible, amount, projectVol, onClose, onSubmit }: ScenarioBookingModalProps) {
    const colors = useColors();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        freelancerName: "",
        freelancerAddress: "",
        freelancerIban: ""
    });

    const [customerId, setCustomerId] = useState("");
    const [projectId, setProjectId] = useState("");

    const [showCustomerPicker, setShowCustomerPicker] = useState(false);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [showUserPicker, setShowUserPicker] = useState(false);
    
    const [customerSearch, setCustomerSearch] = useState("");
    const [projectSearch, setProjectSearch] = useState("");
    const [userSearch, setUserSearch] = useState("");

    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: Data.getCustomersWithCounts,
        enabled: visible,
    });

    const { data: projects } = useQuery({
        queryKey: ["projects"],
        queryFn: Data.getAllProjects,
        enabled: visible,
    });

    const { data: users } = useQuery({
        queryKey: ["users"],
        queryFn: Data.getAllUsers,
        enabled: visible,
    });

    const selectedCustomer = (customers as any[])?.find((c: any) => c.id === customerId);
    const selectedProject = (projects as any[])?.find((p: any) => p.id === projectId);

    const handleSubmit = async () => {
        if (!form.freelancerName.trim() || !form.freelancerAddress.trim()) {
            showAlert("Fehler", "Bitte mindestens Name und Adresse der Privatperson eingeben.");
            return;
        }
        if (!customerId) {
            showAlert("Fehler", "Bitte einen Kunden auswählen, für den die Leistung erbracht wurde.");
            return;
        }
        if (!projectId) {
            showAlert("Fehler", "Bitte ein Projekt auswählen, für das die Leistung erbracht wurde.");
            return;
        }

        setLoading(true);
        try {
            await onSubmit({
                ...form,
                customerId,
                projectId,
                customerName: selectedCustomer ? (selectedCustomer.company_name || `${selectedCustomer.first_name || ""} ${selectedCustomer.last_name || ""}`.trim()) : "Unbekannt",
                projectName: selectedProject ? selectedProject.name : "Unbekannt"
            });
            // Form is reset and closed by the parent or on success
            setForm({ freelancerName: "", freelancerAddress: "", freelancerIban: "" });
            setCustomerId("");
            setProjectId("");
        } catch (err: any) {
            showAlert("Fehler", err.message || "Es ist ein Fehler aufgetreten.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                    }}
                >
                    <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                        <Text style={{ color: colors.primary, fontSize: 16 }}>Abbrechen</Text>
                    </TouchableOpacity>
                    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>
                        Automatisch Verbuchen
                    </Text>
                    <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.7}>
                        <Text style={{ color: loading ? colors.muted : colors.primary, fontSize: 16, fontWeight: "600" }}>
                            {loading ? "..." : "Verbuchen"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                            Leistungsabrechnung erstellen
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 20 }}>
                            Mit dieser Funktion wird automatisch eine Abrechnung/Quittung über {formatCurrency(amount)} CHF erstellt, 
                            als PDF gespeichert und direkt in die Buchhaltung als neue Ausgabe ("Fremdleistungen / Lohnaufwand") inkl. Beleg verbucht.
                        </Text>
                    </View>

                    {/* Formular-Felder */}
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        
                        {/* Optionaler Mitarbeiter-Picker */}
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Bestehenden Mitarbeiter auswählen (optional)</Text>
                        <TouchableOpacity
                            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24 }}
                            onPress={() => setShowUserPicker(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>
                                🔍 Mitarbeiter suchen...
                            </Text>
                        </TouchableOpacity>

                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Vorname & Nachname *</Text>
                        <TextInput
                            style={{ fontSize: 15, color: colors.foreground, padding: 0, marginBottom: 16 }}
                            value={form.freelancerName}
                            onChangeText={(v) => setForm({ ...form, freelancerName: v })}
                            placeholder="z.B. Max Mustermann"
                            placeholderTextColor={colors.muted}
                        />

                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Vollständige Adresse *</Text>
                        <TextInput
                            style={{ fontSize: 15, color: colors.foreground, padding: 0, minHeight: 60, textAlignVertical: "top", marginBottom: 16 }}
                            value={form.freelancerAddress}
                            onChangeText={(v) => setForm({ ...form, freelancerAddress: v })}
                            placeholder="Musterstrasse 1&#10;8000 Zürich"
                            placeholderTextColor={colors.muted}
                            multiline
                        />

                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>IBAN für Auszahlung (Optional)</Text>
                        <TextInput
                            style={{ fontSize: 15, color: colors.foreground, padding: 0 }}
                            value={form.freelancerIban}
                            onChangeText={(v) => setForm({ ...form, freelancerIban: v })}
                            placeholder="CHXX XXXX XXXX XXXX XXXX X"
                            placeholderTextColor={colors.muted}
                        />
                    </View>

                    {/* Projekt Zuweisung */}
                    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600", marginBottom: 12 }}>
                            Zuweisung
                        </Text>

                        {/* Kunde auswählen */}
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Kunde *</Text>
                        <TouchableOpacity
                            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}
                            onPress={() => setShowCustomerPicker(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: selectedCustomer ? colors.foreground : colors.muted, fontSize: 15 }}>
                                {selectedCustomer
                                    ? selectedCustomer.company_name || `${selectedCustomer.first_name || ""} ${selectedCustomer.last_name || ""}`.trim() || "Unbenannt"
                                    : "Kunde auswählen..."}
                            </Text>
                        </TouchableOpacity>

                        {/* Projekt auswählen */}
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6, fontWeight: "600" }}>Projekt *</Text>
                        <TouchableOpacity
                            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 }}
                            onPress={() => setShowProjectPicker(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: selectedProject ? colors.foreground : colors.muted, fontSize: 15 }}>
                                {selectedProject
                                    ? `${selectedProject.project_number} - ${selectedProject.name}`
                                    : "Projekt auswählen..."}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* Kunden-Picker Modal */}
            <Modal visible={showCustomerPicker} animationType="slide" transparent onRequestClose={() => setShowCustomerPicker(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.foreground }}>Kunde auswählen</Text>
                            <TouchableOpacity onPress={() => setShowCustomerPicker(false)} activeOpacity={0.7}>
                                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                                <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                                <TextInput
                                    style={{ flex: 1, marginLeft: 8, fontSize: 16, color: colors.foreground, padding: 0 }}
                                    placeholder="Kunde suchen..."
                                    placeholderTextColor={colors.muted}
                                    value={customerSearch}
                                    onChangeText={setCustomerSearch}
                                    autoFocus
                                />
                            </View>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                            {(() => {
                                const query = customerSearch.toLowerCase();
                                const filtered = customers?.filter((c: any) => {
                                    if (!query) return true;
                                    return (
                                        c.company_name?.toLowerCase().includes(query) ||
                                        c.first_name?.toLowerCase().includes(query) ||
                                        c.last_name?.toLowerCase().includes(query) ||
                                        c.email?.toLowerCase().includes(query)
                                    );
                                });
                                return filtered && filtered.length > 0 ? (
                                    filtered.map((c: any) => (
                                        <TouchableOpacity
                                            key={c.id}
                                            style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                marginBottom: 8,
                                                borderWidth: 1,
                                                borderColor: customerId === c.id ? colors.primary : colors.border,
                                                backgroundColor: customerId === c.id ? `${colors.primary}1A` : colors.surface,
                                            }}
                                            onPress={() => {
                                                setCustomerId(c.id);
                                                setShowCustomerPicker(false);
                                                setCustomerSearch("");
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                                                {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unbenannt"}
                                            </Text>
                                            {c.email ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{c.email}</Text> : null}
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: 16 }}>Keine Kunden gefunden</Text>
                                );
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Project-Picker Modal */}
            <Modal visible={showProjectPicker} animationType="slide" transparent onRequestClose={() => setShowProjectPicker(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.foreground }}>Projekt auswählen</Text>
                            <TouchableOpacity onPress={() => setShowProjectPicker(false)} activeOpacity={0.7}>
                                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                                <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                                <TextInput
                                    style={{ flex: 1, marginLeft: 8, fontSize: 16, color: colors.foreground, padding: 0 }}
                                    placeholder="Projekt suchen..."
                                    placeholderTextColor={colors.muted}
                                    value={projectSearch}
                                    onChangeText={setProjectSearch}
                                    autoFocus
                                />
                            </View>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                            {(() => {
                                const query = projectSearch.toLowerCase();
                                const filtered = (projects as any[])?.filter((p: any) => {
                                    // If a customer is selected, ONLY show projects for that customer
                                    if (customerId && p.customer_id !== customerId) return false;
                                    
                                    if (!query) return true;
                                    return (
                                        p.name?.toLowerCase().includes(query) ||
                                        p.project_number?.toLowerCase().includes(query)
                                    );
                                });
                                return filtered && filtered.length > 0 ? (
                                    filtered.map((p: any) => (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                marginBottom: 8,
                                                borderWidth: 1,
                                                borderColor: projectId === p.id ? colors.primary : colors.border,
                                                backgroundColor: projectId === p.id ? `${colors.primary}1A` : colors.surface,
                                            }}
                                            onPress={() => {
                                                setProjectId(p.id);
                                                // Auto-select customer if not already selected
                                                if (!customerId && p.customer_id) {
                                                    setCustomerId(p.customer_id);
                                                }
                                                setShowProjectPicker(false);
                                                setProjectSearch("");
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                                                {p.project_number} - {p.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: 16 }}>
                                        {customerId ? "Keine Projekte für diesen Kunden gefunden" : "Keine Projekte gefunden"}
                                    </Text>
                                );
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* User-Picker Modal */}
            <Modal visible={showUserPicker} animationType="slide" transparent onRequestClose={() => setShowUserPicker(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.foreground }}>Mitarbeiter auswählen</Text>
                            <TouchableOpacity onPress={() => setShowUserPicker(false)} activeOpacity={0.7}>
                                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                                <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                                <TextInput
                                    style={{ flex: 1, marginLeft: 8, fontSize: 16, color: colors.foreground, padding: 0 }}
                                    placeholder="Nach Name oder E-Mail suchen..."
                                    placeholderTextColor={colors.muted}
                                    value={userSearch}
                                    onChangeText={setUserSearch}
                                    autoFocus
                                />
                            </View>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                            {(() => {
                                const query = userSearch.toLowerCase();
                                const filtered = users?.filter((u: any) => {
                                    if (!query) return true;
                                    return (
                                        u.name?.toLowerCase().includes(query) ||
                                        u.email?.toLowerCase().includes(query)
                                    );
                                });
                                return filtered && filtered.length > 0 ? (
                                    filtered.map((u: any) => (
                                        <TouchableOpacity
                                            key={u.id}
                                            style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                marginBottom: 8,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                backgroundColor: colors.surface,
                                            }}
                                            onPress={() => {
                                                setForm({
                                                    ...form,
                                                    freelancerName: u.name || "",
                                                    freelancerAddress: u.address || "",
                                                    freelancerIban: u.iban || "",
                                                });
                                                setShowUserPicker(false);
                                                setUserSearch("");
                                                showAlert("Übernommen", `Daten von ${u.name || u.email} wurden in das Formular eingefügt.`);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                                                {u.name || "Kein Name"}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                                                {u.email}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: 16 }}>
                                        Keine Mitarbeiter gefunden
                                    </Text>
                                );
                            })()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

