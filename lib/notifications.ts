import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(userType: "admin" | "customer", userId: string, userEmail?: string) {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'GCT Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0A7EA4',
    });
  }

  if (Device.isDevice || Platform.OS === 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId
        ?? Constants?.easConfig?.projectId
        ?? "f1e370f0-264c-4354-bec5-3295208bfd21"; // Hardcoded fallback for standalone builds

      console.log('[Push] Project ID:', projectId);

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      console.log('[Push] Token:', token);

      if (token) {
        try {
          const { data: saveResult, error: saveError } = await supabase.functions.invoke('send-push', {
            body: {
              action: 'save-token',
              userId,
              userType,
              pushToken: token,
              userEmail,
            },
          });

          if (saveError) {
            console.error('[Push] Edge Function save failed:', saveError.message);
            const { error: directError } = await supabase
              .from(userType === "admin" ? "users" : "customer_portal_users")
              .update({ push_token: token })
              .eq("id", userId);
            if (directError) {
              console.error('[Push] Direct save also failed:', directError.message);
            } else {
              console.log('[Push] Token saved via direct update fallback');
            }
          } else {
            console.log('[Push] Token saved successfully via Edge Function', JSON.stringify(saveResult));
          }
        } catch (err) {
          console.error('[Push] Token save error:', err);
        }
      }
    } catch (e) {
      console.error('[Push] Error fetching Expo Push token:', e);
    }
  } else {
    console.log('Must use a physical device for Push Notifications');
  }

  return token;
}
