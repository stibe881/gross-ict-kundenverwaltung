import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { useColors } from "@/hooks/use-colors";

export default function ScannerScreen() {
    const router = useRouter();
    const colors = useColors();
    const [isScanning, setIsScanning] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const openScanner = async () => {
                if (isScanning || !hasPermission) return;
                
                try {
                    setIsScanning(true);
                    
                    // Web Fallback: Document scanner doesn't work on Web
                    if (Platform.OS === 'web') {
                        router.replace("/accounting");
                        return;
                    }

                    // Safely try to load the native module without triggering RedBox
                    let DocumentScanner = null;
                    
                    // Prevent Metro from evaluating the require in Expo Go entirely by doing it at runtime,
                    // but DO NOT use eval() because Metro needs to see the string literal to bundle it!
                    if (Constants.appOwnership !== 'expo') {
                        try {
                            const plugin = require('react-native-document-scanner-plugin');
                            DocumentScanner = plugin.default || plugin;
                        } catch (e) {
                            console.log("Native document scanner not linked:", e);
                        }
                    }

                    if (DocumentScanner) {
                        // Native Document Scanner is available!
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
                            if (router.canGoBack()) router.back();
                            else router.replace("/accounting");
                        }
                    } else {
                        // Fallback: Use standard Expo ImagePicker (e.g. in Expo Go)
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.8,
                        });

                        if (!isActive) return;

                        if (!result.canceled && result.assets && result.assets[0]) {
                            const uri = encodeURIComponent(result.assets[0].uri);
                            const name = encodeURIComponent(result.assets[0].fileName || `Beleg_${Date.now()}.jpg`);
                            const type = encodeURIComponent(result.assets[0].mimeType || "image/jpeg");
                            
                            router.replace(`/accounting?action=scan&uri=${uri}&name=${name}&type=${type}`);
                        } else {
                            if (router.canGoBack()) router.back();
                            else router.replace("/accounting");
                        }
                    }

                } catch (error) {
                    console.error("Scanner error:", error);
                    router.replace("/accounting");
                } finally {
                    if (isActive) setIsScanning(false);
                }
            };

            // Only trigger automatically if we have permission
            if (hasPermission) {
                openScanner();
            }

            return () => {
                isActive = false;
            };
        }, [hasPermission])
    );

    if (hasPermission === null) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text style={{ color: colors.foreground, textAlign: 'center' }}>
                    Kein Zugriff auf die Kamera. Bitte erteilen Sie die Berechtigung in den Einstellungen.
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
             <ActivityIndicator size="large" color={colors.primary} />
             <Text style={{ marginTop: 12, color: colors.muted }}>Scanner wird gestartet...</Text>
        </View>
    );
}
