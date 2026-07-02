import { Alert, Platform } from "react-native";

/**
 * Cross-platform alert that works on Web, iOS, and Android.
 * On web, uses window.alert/window.confirm instead of React Native's Alert.
 */
export function showAlert(title: string, message?: string) {
    if (Platform.OS === "web") {
        window.alert(message ? `${title}\n\n${message}` : title);
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
    if (Platform.OS === "web") {
        if (window.confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
    } else {
        Alert.alert(title, message, [
            { text: cancelText, style: "cancel" },
            { text: confirmText, style: "destructive", onPress: onConfirm },
        ]);
    }
}

/**
 * Three-button confirm dialog: primary action, secondary action, cancel.
 * On web: primary is shown first, cancel leads to secondary.
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
        if (window.confirm(`${title}\n\n${message}\n\n[OK = ${primaryText} / Abbrechen = ${secondaryText}]`)) {
            onPrimary();
        } else {
            onSecondary();
        }
    } else {
        Alert.alert(title, message, [
            { text: cancelText, style: "cancel" },
            { text: secondaryText, onPress: onSecondary },
            { text: primaryText, style: "default", onPress: onPrimary },
        ]);
    }
}
