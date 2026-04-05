/**
 * Lokale Benachrichtigungen für Lead-Erinnerungen.
 * iOS / Android liefert diese exakt zum gesetzten Zeitpunkt,
 * auch wenn die App komplett geschlossen ist.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Plant eine lokale Benachrichtigung für eine Erinnerung.
 * Gibt den Notification-Identifier zurück (= reminder.id),
 * der zum Stornieren verwendet werden kann.
 */
export async function scheduleReminderNotification(
  reminderId: string,
  leadName: string,
  note: string,
  remindAt: Date
): Promise<void> {
  if (Platform.OS === "web") return; // Lokale Benachrichtigungen nicht auf Web

  try {
    // Berechtigungen prüfen / anfragen
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== "granted") return;
    }

    // Eventuell vorhandene Benachrichtigung für diese Erinnerung abbrechen
    await cancelReminderNotification(reminderId);

    // Nur in der Zukunft planen
    if (remindAt <= new Date()) return;

    await Notifications.scheduleNotificationAsync({
      identifier: reminderId,
      content: {
        title: `🔔 Erinnerung: ${leadName}`,
        body: note,
        sound: true,
        data: { reminderId, url: "/leads" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: remindAt,
      },
    });

    console.log(`[LocalNotif] Geplant für ${remindAt.toLocaleString("de-CH")} (id: ${reminderId})`);
  } catch (e) {
    console.warn("[LocalNotif] Fehler beim Planen:", e);
  }
}

/**
 * Storniert eine geplante lokale Benachrichtigung.
 */
export async function cancelReminderNotification(reminderId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId);
  } catch (_) {
    // Ignorieren falls keine Benachrichtigung geplant war
  }
}

/**
 * Storniert alle geplanten lokalen Benachrichtigungen.
 */
export async function cancelAllReminderNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (_) {}
}
