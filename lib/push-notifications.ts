import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Konfiguriere wie Benachrichtigungen angezeigt werden
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.log("[Push] Notification handler setup skipped (Expo Go limitation)");
}

export interface PushNotificationService {
  requestPermissions: () => Promise<boolean>;
  getPushToken: () => Promise<string | null>;
  sendTicketNotification: (ticketTitle: string, customerName: string) => Promise<void>;
  scheduledLocalNotification: (title: string, body: string, seconds?: number) => Promise<void>;
}

/**
 * Fordert Push-Notification-Berechtigungen an
 */
export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log("[Push] Web platform - skipping permission request");
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission not granted");
    return false;
  }

  console.log("[Push] Permission granted");
  return true;
}

/**
 * Holt den Push-Token für dieses Gerät
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "f1e370f0-264c-4354-bec5-3295208bfd21",
    });

    console.log("[Push] Token:", token.data);

    // Speichere Token lokal
    await AsyncStorage.setItem("pushToken", token.data);

    return token.data;
  } catch (error) {
    console.error("[Push] Error getting token:", error);
    return null;
  }
}

/**
 * Sendet eine lokale Benachrichtigung für ein neues Ticket
 */
export async function sendTicketNotification(
  ticketTitle: string,
  customerName: string
): Promise<void> {
  if (Platform.OS === "web") {
    console.log("[Push] Web platform - skipping notification");
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🎫 Neues Ticket",
        body: `${customerName}: ${ticketTitle}`,
        data: { type: "new_ticket", ticketTitle, customerName },
        sound: true,
      },
      trigger: null, // Sofort senden
    });

    console.log("[Push] Ticket notification sent");
  } catch (error) {
    console.error("[Push] Error sending notification:", error);
  }
}

/**
 * Sendet eine geplante lokale Benachrichtigung
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  seconds: number = 0
): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: seconds > 0 ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds } : null,
    });
  } catch (error) {
    console.error("[Push] Error scheduling notification:", error);
  }
}

/**
 * Initialisiert Push-Notifications beim App-Start
 */
export async function initializePushNotifications(): Promise<void> {
  const hasPermission = await requestPermissions();

  if (hasPermission) {
    await getPushToken();
  }
}
