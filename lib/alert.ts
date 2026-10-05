import { Alert, Platform } from "react-native";
import { showDialog } from "@/components/dialog-provider";

/**
 * Zentrale Dialoge. Auf iOS/Android die nativen System-Dialoge (Alert.alert),
 * im Web app-eigene, gestylte Dialoge statt der Browser-Popups
 * ("portal.gross-ict.ch enthält ...").
 */
export function showAlert(title: string, message?: string) {
    if (Platform.OS === "web") {
        showDialog({ title, message, buttons: [{ text: "OK", style: "primary" }] });
    } else {
        Alert.alert(title, message);
    }
}

export function showConfirm(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = "OK",
    cancelText: string = "Abbrechen"
) {
    const destructive = /löschen|entfernen|stornieren|verwerfen/i.test(confirmText);
    if (Platform.OS === "web") {
        showDialog({
            title,
            message,
            buttons: [
                { text: cancelText, style: "cancel" },
                { text: confirmText, style: destructive ? "destructive" : "primary", onPress: onConfirm },
            ],
        });
    } else {
        Alert.alert(title, message, [
            { text: cancelText, style: "cancel" },
            { text: confirmText, style: "destructive", onPress: onConfirm },
        ]);
    }
}

/**
 * Drei-Knopf-Dialog: Primäraktion, Sekundäraktion, Abbrechen.
 */
export function showConfirm2(
    title: string,
    message: string,
    primaryText: string,
    onPrimary: () => void,
    secondaryText: string,
    onSecondary: () => void,
    cancelText: string = "Abbrechen"
) {
    if (Platform.OS === "web") {
        showDialog({
            title,
            message,
            buttons: [
                { text: primaryText, style: "primary", onPress: onPrimary },
                { text: secondaryText, style: "default", onPress: onSecondary },
                { text: cancelText, style: "cancel" },
            ],
        });
    } else {
        Alert.alert(title, message, [
            { text: cancelText, style: "cancel" },
            { text: secondaryText, onPress: onSecondary },
            { text: primaryText, style: "default", onPress: onPrimary },
        ]);
    }
}
