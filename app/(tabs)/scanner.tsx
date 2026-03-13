import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/use-colors";

export default function ScannerScreen() {
    const router = useRouter();
    const colors = useColors();
    const [isScanning, setIsScanning] = useState(false);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const openScanner = async () => {
                if (isScanning) return;
                
                try {
                    setIsScanning(true);
                    
                    // Web Fallback: Document scanner doesn't work on Web
                    if (Platform.OS === 'web') {
                        router.replace("/accounting");
                        return;
                    }

                    // Load dynamically to prevent crashes if native module is not built
                    let DocumentScanner;
                    try {
                        const plugin = require("react-native-document-scanner-plugin");
                        DocumentScanner = plugin.default || plugin;
                    } catch (e) {
                        if (isActive) {
                            Alert.alert("Fehlendes Modul", "Der Beleg-Scanner erfordert ein App-Update (nativer Code). Bitte App neu kompilieren.");
                            router.replace("/accounting");
                        }
                        return;
                    }

                    const { scannedImages, status } = await DocumentScanner.scanDocument({
                        croppedImageQuality: 80,
                        maxNumDocuments: 1
                    });

                    if (!isActive) return;

                    if (status === 'success' && scannedImages && scannedImages.length > 0) {
                        const fileUri = scannedImages[0];
                        const uri = encodeURIComponent(fileUri);
                        const name = encodeURIComponent(`ScannerBeleg_${Date.now()}.jpg`);
                        const type = encodeURIComponent("image/jpeg");
                        
                        router.replace(`/accounting?action=scan&uri=${uri}&name=${name}&type=${type}`);
                    } else {
                        // User cancelled
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/accounting");
                        }
                    }
                } catch (error) {
                    console.error("Scanner error:", error);
                    router.replace("/accounting");
                } finally {
                    if (isActive) setIsScanning(false);
                }
            };

            openScanner();

            return () => {
                isActive = false;
            };
        }, [])
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
             <ActivityIndicator size="large" color={colors.primary} />
             <Text style={{ marginTop: 12, color: colors.muted }}>Scanner wird gestartet...</Text>
        </View>
    );
}
