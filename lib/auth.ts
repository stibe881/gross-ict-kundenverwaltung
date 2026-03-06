/**
 * Supabase Auth wrapper — handles SSO (Microsoft), email/password login, and session management.
 */
import { supabase } from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

// Ensure browser auth sessions are completed on native
if (Platform.OS !== "web") {
    WebBrowser.maybeCompleteAuthSession();
}

/**
 * Sign in with email and password via Supabase Auth.
 */
export async function signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;

    // Persist login state for the app
    if (data.user) {
        await AsyncStorage.setItem("isLoggedIn", "true");
        await AsyncStorage.setItem("userEmail", data.user.email || "");
        await AsyncStorage.setItem("userName", data.user.user_metadata?.full_name || data.user.email || "");
    }

    return data;
}

/**
 * Sign in with Microsoft (Azure AD) via Supabase OAuth.
 * Opens a browser for the OAuth flow.
 */
export async function signInWithMicrosoft() {
    // Redirect back to the app root — the global auth listener in _layout.tsx
    // will detect the SIGNED_IN event and navigate to the dashboard.
    const redirectTo = Platform.OS === "web"
        ? window.location.origin
        : Linking.createURL("oauth/callback");

    console.log("[Auth] OAuth redirectTo:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
            redirectTo,
            scopes: "openid profile email",
            queryParams: {
                prompt: "select_account",
            },
        },
    });

    if (error) throw error;

    if (data.url) {
        if (Platform.OS === "web") {
            // On web: redirect directly
            window.location.href = data.url;
        } else {
            // Native (iOS + Android): openAuthSessionAsync handles redirect interception
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo
            );

            if (result.type === "success" && result.url) {
                // Extract tokens from the callback URL hash
                const hashIndex = result.url.indexOf("#");
                const hash = hashIndex >= 0 ? result.url.substring(hashIndex + 1) : "";
                const params = new URLSearchParams(hash);
                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");

                console.log("[Auth] OAuth callback result:", { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, url: result.url.substring(0, 80) });

                if (accessToken) {
                    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || "",
                    });

                    if (sessionError) throw sessionError;

                    if (sessionData.user) {
                        await AsyncStorage.setItem("isLoggedIn", "true");
                        await AsyncStorage.setItem("userEmail", sessionData.user.email || "");
                        await AsyncStorage.setItem("userName", sessionData.user.user_metadata?.full_name || sessionData.user.email || "");
                    }

                    return sessionData;
                } else {
                    console.error("[Auth] No access_token found in callback URL:", result.url);
                }
            } else {
                console.log("[Auth] OAuth browser result:", result.type);
            }
        }
    }

    return null;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem("isLoggedIn");
    await AsyncStorage.removeItem("userEmail");
    await AsyncStorage.removeItem("userName");
}

/**
 * Get the current Supabase session.
 */
export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/**
 * Get the current user.
 */
export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
}
