import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/use-colors";
import { useCallback } from "react";

export default function ScannerScreen() {
    const router = useRouter();
    const colors = useColors();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const openCamera = async () => {
                if (isScanning) return; // Prevent double trigger
                
                try {
                    setIsScanning(true);
                    const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 0.8,
                    });

                    if (!isActive) return;

                    if (!result.canceled && result.assets && result.assets[0]) {
                        // Pass the URI to accounting
                        const uri = encodeURIComponent(result.assets[0].uri);
                        const name = encodeURIComponent(result.assets[0].fileName || `Beleg_${Date.now()}.jpg`);
                        const type = encodeURIComponent(result.assets[0].mimeType || "image/jpeg");
                        
                        router.replace(`/accounting?action=scan&uri=${uri}&name=${name}&type=${type}`);
                    } else {
                        // User cancelled camera, go back or default to accounting
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/accounting");
                        }
                    }
                } catch (error) {
                    console.error("Camera error:", error);
                    router.replace("/accounting");
                } finally {
                    if (isActive) setIsScanning(false);
                }
            };

            if (hasPermission) {
                openCamera();
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
             {/* SHow loading while camera initializes */}
             <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}
