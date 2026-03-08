import { useState, useEffect } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, Image, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
                                <View className="w-8 h-8 rounded-md items-center justify-center mr-2" style={{ backgroundColor: '#222' }}>
                                    <Text style={{ color: '#D4A432', fontWeight: 'bold' }}>G</Text>
                                </View>
                                <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Gross ICT</Text>
                            </View>
                        </View>

                        {/* Golden Accent Bar */}
                        <View className="w-full h-1 mt-4" style={{ backgroundColor: '#D4A432' }} />

                        {/* Pass Content */}
                        <View className="px-5 pt-6 pb-2">
                            <Text style={{ color: '#888', fontSize: 11, marginBottom: 2, textTransform: 'uppercase' }}>MITARBEITER</Text>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }} numberOfLines={1}>{name || 'Max Mustermann'}</Text>
                            <Text style={{ color: '#D4A432', fontSize: 13, fontWeight: '500', marginBottom: 16 }} numberOfLines={1}>{position || 'Position'}</Text>

                            <View className="flex-row justify-between mt-2">
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
                        <View className="bg-[#111] mt-auto w-full items-center py-4 border-t border-[#222]">
                            <IconSymbol name="qrcode" size={48} color="white" />
                        </View>
                    </View>
                </View>

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
        </ScreenContainer>
    );
}
