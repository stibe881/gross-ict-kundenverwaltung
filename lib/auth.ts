/**
 * Supabase Auth wrapper — handles SSO (Microsoft), email/password login, and session management.
 */
import { supabase } from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import Constants from "expo-constants";

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
        const isCustomer = !!data.user.user_metadata?.customer_id;
        if (isCustomer) {
            await AsyncStorage.setItem("isCustomerLoggedIn", "true");
            await AsyncStorage.setItem("customerEmail", data.user.email || "");
            await AsyncStorage.setItem('customer_portal_user', JSON.stringify({
              id: data.user.id,
              email: data.user.email,
            }));
        } else {
            await AsyncStorage.setItem("isLoggedIn", "true");
            await AsyncStorage.setItem("userEmail", data.user.email || "");
            await AsyncStorage.setItem("userName", data.user.user_metadata?.full_name || data.user.email || "");
        }
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
    let redirectTo: string;
    if (Platform.OS === "web") {
        redirectTo = window.location.origin;
    } else {
        // In Expo Go, Linking.createURL uses exp:// scheme which works correctly.
        // In standalone builds, it uses the custom scheme from app.config.ts.
        redirectTo = Linking.createURL("oauth/callback");
    }

    console.log("[Auth] OAuth redirectTo:", redirectTo);
    console.log("[Auth] Execution env:", Constants.executionEnvironment);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
            redirectTo,
            scopes: "openid profile email",
            skipBrowserRedirect: true,  // We handle the browser ourselves
            queryParams: {
                prompt: "select_account",
            },
        },
    });

    if (error) throw error;

    if (data.url) {
        if (Platform.OS === "web") {
            window.location.href = data.url;
        } else {
            // Native (iOS + Android): Use openAuthSessionAsync with PKCE
            // ASWebAuthenticationSession intercepts the HTTP 302 redirect to exp://
            console.log("[Auth] Native: openAuthSessionAsync with redirectTo:", redirectTo);
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo,
                { preferEphemeralSession: true }
            );

            console.log("[Auth] Native result type:", result.type);

            if (result.type === "success" && result.url) {
                console.log("[Auth] Callback URL:", result.url.substring(0, 120));

                // Try PKCE flow first: extract ?code= query parameter
                const urlObj = new URL(result.url);
                const code = urlObj.searchParams.get("code");

                if (code) {
                    console.log("[Auth] PKCE code received, exchanging for session...");
                    const { data: sessionData, error: sessionError } = 
                        await supabase.auth.exchangeCodeForSession(code);

                    if (sessionError) {
                        console.error("[Auth] Code exchange error:", sessionError);
                        throw sessionError;
                    }

                    await saveSessionToStorage(sessionData);
                    return sessionData;
                }

                // Fallback: implicit flow with hash fragment (#access_token=...)
                const hashIndex = result.url.indexOf("#");
                const hash = hashIndex >= 0 ? result.url.substring(hashIndex + 1) : "";
                const params = new URLSearchParams(hash);
                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");

                if (accessToken) {
                    console.log("[Auth] Implicit flow tokens received");
                    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || "",
                    });

                    if (sessionError) throw sessionError;
                    await saveSessionToStorage(sessionData);
                    return sessionData;
                }

                console.error("[Auth] No code or access_token in callback URL");
            } else {
                console.log("[Auth] Auth session returned:", result.type);
            }
        }
    }

    return null;
}

/** Helper: persist user session info to AsyncStorage */
async function saveSessionToStorage(sessionData: any) {
    if (!sessionData?.user) return;
    const isCustomer = !!sessionData.user.user_metadata?.customer_id;
    if (isCustomer) {
        await AsyncStorage.setItem("isCustomerLoggedIn", "true");
        await AsyncStorage.setItem("customerEmail", sessionData.user.email || "");
        await AsyncStorage.setItem('customer_portal_user', JSON.stringify({
            id: sessionData.user.id,
            email: sessionData.user.email,
        }));
    } else {
        await AsyncStorage.setItem("isLoggedIn", "true");
        await AsyncStorage.setItem("userEmail", sessionData.user.email || "");
        await AsyncStorage.setItem("userName", sessionData.user.user_metadata?.full_name || sessionData.user.email || "");
    }
}

/**
 * Sign in with Apple (native iOS only).
 * Uses expo-apple-authentication for the native Apple sign-in UI,
 * then passes the identity token to Supabase.
 */
export async function signInWithApple() {
    if (Platform.OS !== "ios") {
        throw new Error("Sign in with Apple is only available on iOS");
    }

    const AppleAuthentication = require("expo-apple-authentication");

    const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
    });

    if (!credential.identityToken) {
        throw new Error("Kein Identity-Token von Apple erhalten");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
    });

    if (error) throw error;

    // Prevent auto-registration: reject users whose account was just created
    if (data.user) {
        const createdAt = new Date(data.user.created_at).getTime();
        const now = Date.now();
        const isNewUser = (now - createdAt) < 10000; // created within last 10 seconds

        if (isNewUser) {
            // New account was auto-created — delete it and sign out
            await supabase.auth.signOut();
            await AsyncStorage.removeItem("isLoggedIn");
            throw new Error("Kein Konto gefunden. Bitte wenden Sie sich an den Administrator.");
        }

        const isCustomer = !!data.user.user_metadata?.customer_id;
        if (isCustomer) {
            await AsyncStorage.setItem("isCustomerLoggedIn", "true");
            await AsyncStorage.setItem("customerEmail", data.user.email || "");
            await AsyncStorage.setItem('customer_portal_user', JSON.stringify({
                id: data.user.id,
                email: data.user.email,
            }));
        } else {
            await AsyncStorage.setItem("isLoggedIn", "true");
            await AsyncStorage.setItem("userEmail", data.user.email || "");
            const name = credential.fullName
                ? `${credential.fullName.givenName || ""} ${credential.fullName.familyName || ""}`.trim()
                : data.user.user_metadata?.full_name || data.user.email || "";
            await AsyncStorage.setItem("userName", name);
        }
    }

    return data;
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
