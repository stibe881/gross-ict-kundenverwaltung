/**
 * Biometric authentication (Face ID / Touch ID) module.
 * Uses expo-local-authentication for hardware biometrics
 * and expo-secure-store for secure credential storage.
 */
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BIOMETRICS_ENABLED_KEY = "biometrics_enabled";
const STORED_EMAIL_KEY = "biometric_email";
const STORED_PASSWORD_KEY = "biometric_password";

/**
 * Check if the device has biometric hardware and is enrolled.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
    if (Platform.OS === "web") return false;

    try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
    } catch {
        return false;
    }
}

/**
 * Get the available biometric types (Face ID, Touch ID, etc.)
 */
export async function getBiometricType(): Promise<string> {
    if (Platform.OS === "web") return "";

    try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            return "Face ID";
        }
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            return "Touch ID";
        }
        return "Biometrie";
    } catch {
        return "Biometrie";
    }
}

/**
 * Prompt the user for biometric authentication.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Anmelden mit Face ID / Touch ID",
            fallbackLabel: "Passwort verwenden",
            disableDeviceFallback: false,
        });
        return result.success;
    } catch {
        return false;
    }
}

/**
 * Check if biometrics login is enabled by the user.
 */
export async function isBiometricsEnabled(): Promise<boolean> {
    try {
        const enabled = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
        return enabled === "true";
    } catch {
        return false;
    }
}

/**
 * Enable or disable biometric login.
 */
export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, enabled.toString());
}

/**
 * Save credentials securely for biometric auto-login.
 */
export async function saveCredentials(email: string, password: string): Promise<void> {
    if (Platform.OS === "web") return;
    await SecureStore.setItemAsync(STORED_EMAIL_KEY, email);
    await SecureStore.setItemAsync(STORED_PASSWORD_KEY, password);
}

/**
 * Retrieve stored credentials for biometric auto-login.
 */
export async function getStoredCredentials(): Promise<{ email: string; password: string } | null> {
    if (Platform.OS === "web") return null;

    try {
        const email = await SecureStore.getItemAsync(STORED_EMAIL_KEY);
        const password = await SecureStore.getItemAsync(STORED_PASSWORD_KEY);
        if (email && password) {
            return { email, password };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Clear stored biometric credentials.
 */
export async function clearCredentials(): Promise<void> {
    if (Platform.OS === "web") return;
    try {
        await SecureStore.deleteItemAsync(STORED_EMAIL_KEY);
        await SecureStore.deleteItemAsync(STORED_PASSWORD_KEY);
    } catch {
        // Ignore errors
    }
}
