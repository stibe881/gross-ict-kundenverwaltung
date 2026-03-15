import { useState, useEffect } from "react";
import { 
    View, 
    Text, 
    ScrollView, 
    TouchableOpacity, 
    ActivityIndicator,
    TextInput,
    Linking,
    Platform,
    Alert,
    Image
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Data from "@/lib/data";

export default function LinksScreen() {
    const colors = useColors();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { isWide, contentPadding } = useResponsiveLayout();

    const [isEditing, setIsEditing] = useState(false);
    const [editingLink, setEditingLink] = useState<any>(null);
    const [form, setForm] = useState<{
        title: string;
        url: string;
        description: string;
        icon: string;
        visibility: string;
        allowed_roles: string[];
        logo_url: string;
        logo_uri: string;
    }>({ 
        title: "", url: "", description: "", icon: "link", 
        visibility: "public", allowed_roles: [], logo_url: "", logo_uri: ""
    });
    const [isSaving, setIsSaving] = useState(false);

    const { data: links = [], isLoading } = useQuery({
        queryKey: ["usefulLinks"],
        queryFn: Data.getUsefulLinks,
    });

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setForm({ ...form, logo_uri: result.assets[0].uri });
        }
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.url.trim()) {
            Alert.alert("Fehler", "Titel und URL sind erforderlich.");
            return;
        }
        
        let finalUrl = form.url.trim();
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }

        setIsSaving(true);
        try {
            let savedLink;
            if (editingLink) {
                savedLink = await Data.updateUsefulLink(editingLink.id, { 
                    title: form.title,
                    url: finalUrl,
                    description: form.description,
                    icon: form.icon,
                    visibility: form.visibility,
                    allowed_roles: form.visibility === 'roles' ? form.allowed_roles : undefined 
                });
            } else {
                savedLink = await Data.createUsefulLink({ 
                    title: form.title,
                    url: finalUrl,
                    description: form.description,
                    icon: form.icon,
                    visibility: form.visibility,
                    allowed_roles: form.visibility === 'roles' ? form.allowed_roles : undefined 
                });
            }

            // Upload logo if a new one was selected
            if (form.logo_uri && form.logo_uri !== form.logo_url) {
                try {
                    await Data.uploadLinkLogo(savedLink.id, form.logo_uri);
                } catch (uploadObjError: any) {
                    console.error("Fehler beim Logo-Upload:", uploadObjError);
                    Alert.alert("Warnung", "Der Link wurde gespeichert, aber das Logo konnte nicht hochgeladen werden.");
                }
            }

            queryClient.invalidateQueries({ queryKey: ["usefulLinks"] });
            setIsEditing(false);
            setEditingLink(null);
            setForm({ title: "", url: "", description: "", icon: "link", visibility: "public", allowed_roles: [], logo_url: "", logo_uri: "" });
        } catch (e: any) {
            Alert.alert("Fehler", e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm("Möchten Sie diesen Link wirklich löschen?")) {
                await executeDelete(id);
            }
        } else {
            Alert.alert("Löschen", "Möchten Sie diesen Link wirklich löschen?", [
                { text: "Abbrechen", style: "cancel" },
                { text: "Löschen", style: "destructive", onPress: () => executeDelete(id) }
            ]);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await Data.deleteUsefulLink(id);
            queryClient.invalidateQueries({ queryKey: ["usefulLinks"] });
        } catch (e: any) {
            Alert.alert("Fehler", e.message);
        }
    };

    const openLink = (url: string) => {
        Linking.openURL(url).catch(err => {
            console.error("Could not open URL:", err);
            Alert.alert("Fehler", "Der Link konnte nicht geöffnet werden.");
        });
    };

    if (isLoading) {
        return (
            <ScreenContainer className="items-center justify-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView 
                className="flex-1"
                contentContainerStyle={{ padding: contentPadding, paddingBottom: 100 }}
            >
                <View style={isWide ? { maxWidth: 800, alignSelf: "center", width: "100%" } : undefined}>
                    
                    <View className="flex-row items-center justify-between mb-8 mt-2">
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ padding: 4, marginLeft: -4 }}>
                                <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                            </TouchableOpacity>
                            <View>
                                <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground }}>Nützliche Links</Text>
                                <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>Wichtige Firmenressourcen und Werkzeuge</Text>
                            </View>
                        </View>
                        {!isEditing && (
                            <TouchableOpacity
                                onPress={() => {
                                    setForm({ title: "", url: "", description: "", icon: "link", visibility: "public", allowed_roles: [], logo_url: "", logo_uri: "" });
                                    setEditingLink(null);
                                    setIsEditing(true);
                                }}
                                style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
                            >
                                <IconSymbol name="plus" size={16} color="#FFFFFF" />
                                <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Neuer Link</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {isEditing && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 24 }}>
                            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground, marginBottom: 16 }}>
                                {editingLink ? "Link bearbeiten" : "Neuen Link hinzufügen"}
                            </Text>
                            
                            <View style={{ gap: 16 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                                    <TouchableOpacity 
                                        onPress={pickImage}
                                        style={{ 
                                            width: 64, height: 64, borderRadius: 16, 
                                            backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
                                            alignItems: "center", justifyContent: "center", overflow: "hidden"
                                        }}
                                    >
                                        {(form.logo_uri || form.logo_url) ? (
                                            <Image source={{ uri: form.logo_uri || form.logo_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                        ) : (
                                            <IconSymbol name="camera.fill" size={24} color={colors.muted} />
                                        )}
                                    </TouchableOpacity>
                                    <View>
                                        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, fontWeight: "500" }}>Logo / Icon (Optional)</Text>
                                        <TouchableOpacity onPress={pickImage} style={{ paddingVertical: 4 }}>
                                            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "500" }}>Bild auswählen</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View>
                                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: "500", marginLeft: 4 }}>Titel *</Text>
                                    <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: Platform.OS === 'web' ? 12 : 14 }}>
                                        <TextInput
                                            value={form.title}
                                            onChangeText={(t) => setForm({...form, title: t})}
                                            placeholder="z.B. IT-Support Portal"
                                            placeholderTextColor={colors.muted}
                                            style={{ fontSize: 15, color: colors.foreground }}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: "500", marginLeft: 4 }}>URL *</Text>
                                    <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: Platform.OS === 'web' ? 12 : 14 }}>
                                        <TextInput
                                            value={form.url}
                                            onChangeText={(t) => setForm({...form, url: t})}
                                            placeholder="z.B. https://portal.gross-ict.ch"
                                            placeholderTextColor={colors.muted}
                                            autoCapitalize="none"
                                            keyboardType="url"
                                            style={{ fontSize: 15, color: colors.foreground }}
                                        />
                                    </View>
                                </View>
                                
                                <View>
                                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: "500", marginLeft: 4 }}>Beschreibung (Optional)</Text>
                                    <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: Platform.OS === 'web' ? 12 : 14 }}>
                                        <TextInput
                                            value={form.description}
                                            onChangeText={(t) => setForm({...form, description: t})}
                                            placeholder="Kurze Notiz zu diesem Link"
                                            placeholderTextColor={colors.muted}
                                            style={{ fontSize: 15, color: colors.foreground }}
                                        />
                                    </View>
                                </View>
                                
                                <View>
                                    <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: "500", marginLeft: 4 }}>Sichtbarkeit</Text>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                        {[
                                            { id: 'public', label: 'Alle User', icon: 'globe' },
                                            { id: 'private', label: 'Nur ich', icon: 'lock.fill' },
                                            { id: 'roles', label: 'Bestimmte Rollen', icon: 'person.2.fill' }
                                        ].map(opt => {
                                            const isSelected = form.visibility === opt.id;
                                            return (
                                                <TouchableOpacity
                                                    key={opt.id}
                                                    onPress={() => setForm({...form, visibility: opt.id})}
                                                    style={{
                                                        flexDirection: "row",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        paddingHorizontal: 16,
                                                        paddingVertical: 12,
                                                        borderRadius: 10,
                                                        backgroundColor: isSelected ? colors.primary + "15" : colors.surface,
                                                        borderWidth: 1,
                                                        borderColor: isSelected ? colors.primary : colors.border
                                                    }}
                                                >
                                                    <IconSymbol name={opt.icon as any} size={16} color={isSelected ? colors.primary : colors.muted} />
                                                    <Text style={{ fontSize: 14, fontWeight: isSelected ? "600" : "400", color: isSelected ? colors.primary : colors.foreground }}>
                                                        {opt.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                </View>

                                {form.visibility === 'roles' && (
                                    <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                                        <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600", marginBottom: 12 }}>Wer darf diesen Link sehen?</Text>
                                        <View style={{ gap: 10 }}>
                                            {Data.ROLE_DEFINITIONS.filter(r => r.key !== 'admin').map(role => {
                                                const isActive = form.allowed_roles.includes(role.key);
                                                return (
                                                    <TouchableOpacity
                                                        key={role.key}
                                                        activeOpacity={0.7}
                                                        onPress={() => {
                                                            let newRoles = [...form.allowed_roles];
                                                            if (isActive) {
                                                                newRoles = newRoles.filter(r => r !== role.key);
                                                            } else {
                                                                newRoles.push(role.key);
                                                            }
                                                            setForm({ ...form, allowed_roles: newRoles });
                                                        }}
                                                        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                                                    >
                                                        <View style={{
                                                            width: 24, height: 24, borderRadius: 6,
                                                            borderWidth: isActive ? 0 : 1, borderColor: colors.border,
                                                            backgroundColor: isActive ? colors.primary : colors.surface,
                                                            alignItems: "center", justifyContent: "center"
                                                        }}>
                                                            {isActive && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
                                                        </View>
                                                        <View>
                                                            <Text style={{ fontSize: 15, fontWeight: isActive ? "600" : "400", color: colors.foreground }}>
                                                                {role.label}
                                                            </Text>
                                                            <Text style={{ fontSize: 12, color: colors.muted }}>{role.description}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )
                                            })}
                                        </View>
                                    </View>
                                )}
                                
                                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => setIsEditing(false)}
                                        style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 }}
                                    >
                                        <Text style={{ color: colors.primary, fontWeight: "600" }}>Abbrechen</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSave}
                                        disabled={isSaving}
                                        style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, opacity: isSaving ? 0.7 : 1 }}
                                    >
                                        <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>{isSaving ? "Speichern..." : "Speichern"}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {!isEditing && links.length === 0 && (
                        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
                            <IconSymbol name="link.circle" size={48} color={colors.muted} />
                            <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: "600", marginTop: 16 }}>Keine Links vorhanden</Text>
                            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, textAlign: "center", maxWidth: 300 }}>
                                Fügen Sie hier nützliche Links für das Team hinzu.
                            </Text>
                        </View>
                    )}

                    <View style={{ gap: 12 }}>
                        {links.map((link: any) => (
                            <TouchableOpacity
                                key={link.id}
                                activeOpacity={0.7}
                                onPress={() => openLink(link.url)}
                                style={{
                                    backgroundColor: colors.surface,
                                    borderRadius: 12,
                                    padding: 16,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 16
                                }}
                            >
                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                    {link.logo_url ? (
                                        <Image source={{ uri: link.logo_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                    ) : (
                                        <IconSymbol name={(link.icon as any) || "link"} size={22} color={colors.primary} />
                                    )}
                                </View>
                                
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 2 }}>{link.title}</Text>
                                    <Text style={{ fontSize: 13, color: colors.primary }} numberOfLines={1}>{link.url}</Text>
                                    {link.description && (
                                        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }} numberOfLines={2}>
                                            {link.description}
                                        </Text>
                                    )}
                                </View>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            setForm({
                                                title: link.title,
                                                url: link.url,
                                                description: link.description || "",
                                                icon: link.icon || "link",
                                                visibility: link.visibility || "public",
                                                allowed_roles: link.allowed_roles || [],
                                                logo_url: link.logo_url || "",
                                                logo_uri: link.logo_url || ""
                                            });
                                            setEditingLink(link);
                                            setIsEditing(true);
                                        }}
                                        style={{ padding: 8 }}
                                    >
                                        <IconSymbol name="pencil" size={18} color={colors.muted} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDelete(link.id);
                                        }}
                                        style={{ padding: 8 }}
                                    >
                                        <IconSymbol name="trash.fill" size={18} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                </View>
            </ScrollView>
        </ScreenContainer>
    );
}
