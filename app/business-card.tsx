import { useState, useEffect } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Image, Platform, Modal } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase";
import * as Data from "@/lib/data";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BusinessCardScreen() {
    const colors = useColors();
    const router = useRouter();

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [position, setPosition] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [website, setWebsite] = useState("https://gross-ict.ch");

    // Employee Selection State
    const [isAdmin, setIsAdmin] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [showUserModal, setShowUserModal] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                setName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "");
                setEmail(session.user.email || "");
                setPhone(session.user.phone || "");
                // Try to load position from DB if user metadata doesn't have it
                const loadProfile = async () => {
                    try {
                        const profile = await Data.getUserProfile(session.user.id).catch(() => null);
                        const isAppAdmin = (session.user as any)?.role === 'admin'
                            || session.user.user_metadata?.role === 'admin'
                            || profile?.role === 'admin'
                            || profile?.role === 'manager'
                            || session.user.email?.includes('stefan.gross');

                        if (isAppAdmin) {
                            setIsAdmin(true);
                            const usersList = await Data.getAllUsers().catch(() => []);
                            setAllUsers(usersList.filter((u: any) => u.is_active !== false));
                        }

                        // Basic default values for Gross ICT
                        if (!session.user.user_metadata?.full_name) {
                            if (session.user.email?.includes('stefan.gross')) {
                                setName("Stefan Gross");
                                setPosition("Inhaber / GF");
                                setPhone("+41 79 414 06 16");
                            }
                        }
                    } catch (e) {
                        console.error(e);
                    } finally {
                        setLoading(false);
                    }
                };
                loadProfile();
            } else {
                setLoading(false);
            }
        });
    }, []);

    // Load saved data when the selected email changes
    useEffect(() => {
        if (!email) return;

        const loadSavedData = async () => {
            try {
                const saved = await AsyncStorage.getItem(`business_card_${email}`);
                if (saved) {
                    const data = JSON.parse(saved);
                    if (data.name) setName(data.name);
                    if (data.position) setPosition(data.position);
                    if (data.phone) setPhone(data.phone);
                    if (data.website) setWebsite(data.website);
                }
            } catch (e) {
                console.error("Error loading saved card data:", e);
            }
        };

        loadSavedData();
    }, [email]);

    const handleSave = async () => {
        if (!email) return;
        try {
            const dataToSave = { name, position, phone, website };
            await AsyncStorage.setItem(`business_card_${email}`, JSON.stringify(dataToSave));
            Alert.alert("Gespeichert", "Die Kartendaten wurden lokal auf diesem Gerät gespeichert.");
        } catch (e) {
            console.error("Error saving card data:", e);
            Alert.alert("Fehler", "Die Daten konnten nicht gespeichert werden.");
        }
    };

    const handleDownload = async () => {
        if (!name || !email) {
            Alert.alert("Fehler", "Bitte fülle die Pflichtfelder (Name, E-Mail) aus.");
            return;
        }

        setGenerating(true);
        try {
            // 1. Call Edge Function to generate .pkpass
            const { data, error } = await supabase.functions.invoke('generate-wallet-pass', {
                body: {
                    name,
                    position,
                    phone,
                    email,
                    website
                },
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error + (data.stack ? '\n' + data.stack : ''));

            // 2. Handle the base64 encoded pkpass data
            if (data && data.file) {
                const base64Data = data.file;
                const filename = `visitenkarte_${name.replace(/\\s+/g, '_').toLowerCase()}.pkpass`;

                if (Platform.OS === 'web') {
                    // Web download
                    const url = `data:application/vnd.apple.pkpass;base64,${base64Data}`;
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    Alert.alert("Erfolg", "Pass wurde heruntergeladen. Öffnen Sie die Datei auf einem Apple-Gerät, um sie zum Wallet hinzuzufügen.");
                } else {
                    // Native device handling
                    const filepath = `${FileSystem.documentDirectory}${filename}`;
                    await FileSystem.writeAsStringAsync(filepath, base64Data, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(filepath, {
                            mimeType: 'application/vnd.apple.pkpass',
                            dialogTitle: 'Visitenkarte zum Wallet hinzufügen',
                        });
                    } else {
                        Alert.alert("Fehler", "Teilen ist auf diesem Gerät nicht verfügbar.");
                    }
                }
            } else {
                throw new Error("Invalid response from server");
            }

        } catch (error: any) {
            console.error("Error generating pass:", error);
            Alert.alert("Fehler", `Die Visitenkarte konnte nicht generiert werden: ${error.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleShareVcard = async () => {
        if (!name) return;
        const filename = name.replace(/\\s+/g, '-').toLowerCase();
        const vcardUrl = `https://bvluvvyvftygnxtmboxw.supabase.co/functions/v1/vcard?name=${encodeURIComponent(name)}&position=${encodeURIComponent(position)}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}&website=${encodeURIComponent(website)}`;

        if (Platform.OS === 'web') {
            window.open(vcardUrl, '_blank');
        } else {
            try {
                await Sharing.shareAsync(vcardUrl, {
                    dialogTitle: 'vCard Link teilen'
                });
            } catch (e) {
                Linking.openURL(vcardUrl);
            }
        }
    };

    if (loading) {
        return (
            <ScreenContainer className="items-center justify-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border bg-surface">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} className="p-2 -ml-2">
                        <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-foreground">Digitale Visitenkarte</Text>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

                {/* Pass Preview Wrapper */}
                <View className="items-center mb-8">
                    <View className="w-full max-w-[350px] shadow-2xl elevation-xl rounded-[20px] overflow-hidden" style={{ backgroundColor: '#000000', borderWidth: 1, borderColor: '#2A2A2A', aspectRatio: 1.6 }}>

                        {/* Pass Header */}
                        <View className="flex-row items-center justify-between px-5 pt-4">
                            <View className="flex-row items-center">
                                <Image
                                    source={require("@/assets/images/favicon.png")}
                                    style={{ width: 120, height: 30 }}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>

                        {/* Golden Accent Bar */}
                        <View className="w-full h-1 mt-4" style={{ backgroundColor: '#D4A432' }} />

                        {/* Pass Content */}
                        <View className="px-5 pt-6 pb-2">
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 2 }} numberOfLines={1}>{name || 'Max Mustermann'}</Text>
                            <Text style={{ color: '#D4A432', fontSize: 13, fontWeight: '500', marginBottom: 8 }} numberOfLines={1}>{position || 'Position'}</Text>

                            <View className="flex-row justify-between">
                                <View className="flex-1">
                                    <Text style={{ color: '#888', fontSize: 10, textTransform: 'uppercase' }}>TELEFON</Text>
                                    <Text style={{ color: 'white', fontSize: 12, marginTop: 2 }}>{phone || '-'}</Text>
                                </View>
                                <View className="flex-1 items-end">
                                    <Text style={{ color: '#888', fontSize: 10, textTransform: 'uppercase' }}>E-MAIL</Text>
                                    <Text style={{ color: 'white', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{email || '-'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Fake QR Area block for preview */}
                        <View className="mt-auto w-full items-center py-4">
                            <IconSymbol name="qrcode" size={48} color="white" />
                        </View>
                    </View>
                </View>

                {/* Employee Selection for Admins */}
                {isAdmin && (
                    <View className="bg-surface p-5 rounded-2xl border border-border shadow-sm mb-6 flex-row justify-between items-center">
                        <View className="flex-1 mr-4">
                            <Text className="text-sm font-semibold text-muted mb-1.5 ml-1">Mitarbeiter auswählen</Text>
                            <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                                {name || "Eigene Karte konfigurieren"}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowUserModal(true)}
                            className="bg-primary/10 px-4 py-3 rounded-xl border border-primary/20"
                        >
                            <Text className="text-primary font-bold">Ändern</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Input Form */}
                <View className="bg-surface p-5 rounded-2xl border border-border shadow-sm mb-6">
                    <Text className="text-lg font-bold text-foreground mb-4">Kartendaten</Text>

                    <View className="gap-4">
                        <View>
                            <Text className="text-sm font-semibold text-muted mb-1.5 ml-1">Name *</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="Name"
                                placeholderTextColor={colors.muted}
                                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-foreground text-base"
                            />
                        </View>

                        <View>
                            <Text className="text-sm font-semibold text-muted mb-1.5 ml-1">Position / Jobtitel</Text>
                            <TextInput
                                value={position}
                                onChangeText={setPosition}
                                placeholder="z.B. Geschäftsführer"
                                placeholderTextColor={colors.muted}
                                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-foreground text-base"
                            />
                        </View>

                        <View>
                            <Text className="text-sm font-semibold text-muted mb-1.5 ml-1">E-Mail *</Text>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="email@beispiel.ch"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor={colors.muted}
                                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-foreground text-base"
                            />
                        </View>

                        <View>
                            <Text className="text-sm font-semibold text-muted mb-1.5 ml-1">Telefon</Text>
                            <TextInput
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="+41 79 123 45 67"
                                keyboardType="phone-pad"
                                placeholderTextColor={colors.muted}
                                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-foreground text-base"
                            />
                        </View>

                        <View>
                            <Text className="text-sm font-semibold text-muted mb-1.5 ml-1">Website</Text>
                            <TextInput
                                value={website}
                                onChangeText={setWebsite}
                                placeholder="https://gross-ict.ch"
                                keyboardType="url"
                                autoCapitalize="none"
                                placeholderTextColor={colors.muted}
                                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 text-foreground text-base"
                            />
                        </View>
                    </View>

                    {/* Added Save button */}
                    <TouchableOpacity
                        onPress={handleSave}
                        activeOpacity={0.8}
                        className="bg-surface border-border border p-4 rounded-xl items-center mt-6 flex-row justify-center gap-2 shadow-sm"
                    >
                        <IconSymbol name="tray.and.arrow.down.fill" size={20} color={colors.foreground} />
                        <Text className="text-foreground font-bold text-lg">Angaben speichern</Text>
                    </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View className="gap-3">
                    <TouchableOpacity
                        onPress={handleDownload}
                        disabled={generating}
                        activeOpacity={0.8}
                        className="w-full rounded-xl py-4 items-center justify-center flex-row gap-2 shadow-sm"
                        style={{ backgroundColor: '#000000', opacity: generating ? 0.7 : 1 }}
                    >
                        {generating ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <IconSymbol name="wallet.pass.fill" size={20} color="white" />
                        )}
                        <Text className="text-lg font-bold" style={{ color: 'white' }}>
                            {generating ? "Generiere..." : "Zu Apple Wallet hinzufügen"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleShareVcard}
                        activeOpacity={0.8}
                        className="w-full bg-surface border border-border rounded-xl py-4 items-center justify-center flex-row gap-2 shadow-sm"
                    >
                        <IconSymbol name="square.and.arrow.up" size={20} color={colors.primary} />
                        <Text className="text-primary text-lg font-bold">
                            vCard Link teilen
                        </Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            <Modal
                visible={showUserModal}
                transparent={true}
                animationType="slide"
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-background rounded-t-3xl pt-6 pb-12 px-5 h-[70%]">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-2xl font-bold text-foreground">Mitarbeiter</Text>
                            <TouchableOpacity onPress={() => setShowUserModal(false)} className="p-2 bg-surface rounded-full">
                                <IconSymbol name="xmark" size={20} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Option for current user */}
                            <TouchableOpacity
                                onPress={() => {
                                    setName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || "");
                                    setEmail(user?.email || "");
                                    setPosition("");
                                    setPhone(user?.phone || "");
                                    setShowUserModal(false);
                                }}
                                className="p-4 bg-surface border border-border rounded-xl mb-3 flex-row items-center justify-between"
                            >
                                <View>
                                    <Text className="text-lg font-semibold text-foreground">Meine Visitenkarte</Text>
                                    <Text className="text-sm text-muted">{user?.email}</Text>
                                </View>
                                <IconSymbol name="person.fill" size={20} color={colors.primary} />
                            </TouchableOpacity>

                            <View className="h-[1px] bg-border my-2" />

                            {/* All Employees */}
                            {allUsers.map((u) => (
                                <TouchableOpacity
                                    key={u.id}
                                    onPress={() => {
                                        setName(u.name);
                                        setEmail(u.email);
                                        setPosition(u.role === 'manager' ? 'Management' : u.role === 'sales' ? 'Vertrieb' : '');
                                        setPhone(""); // Reset phone as it's not in the users table
                                        setShowUserModal(false);
                                    }}
                                    className="p-4 bg-surface rounded-xl mb-2 flex-row items-center justify-between"
                                >
                                    <View>
                                        <Text className="text-lg font-semibold text-foreground">{u.name}</Text>
                                        <Text className="text-sm text-muted">{u.email}</Text>
                                    </View>
                                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScreenContainer>
    );
}
