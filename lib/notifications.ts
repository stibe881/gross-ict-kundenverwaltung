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

export async function registerForPushNotificationsAsync(userType: "admin" | "customer", userId: string) {
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
    console.log('[Push] Permission granted');

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
      console.log('[Push] Project ID:', projectId);

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      console.log('[Push] Token:', token);

      if (token) {
        const table = userType === "admin" ? "users" : "customer_portal_users";
        
        // Try direct update first
        const { error, count } = await supabase
          .from(table)
          .update({ push_token: token })
          .eq("id", userId)
          .select();
        
        if (error) {
          console.error(`[Push] Direct save failed for ${userType}:`, error.message);
        }
        
        // Verify token was actually saved by reading it back
        const { data: verify } = await supabase.from(table).select("push_token").eq("id", userId).single();
        
        if (verify?.push_token === token) {
          console.log(`[Push] Token saved successfully for ${userType}`);
        } else {
          console.warn(`[Push] Token NOT saved (RLS?). Trying Edge Function fallback...`);
          // Fallback: save via Edge Function which uses service role key
          try {
            await supabase.functions.invoke('send-push', {
              body: { 
                action: 'save-token',
                userId,
                userType,
                pushToken: token,
              },
            });
            console.log(`[Push] Token saved via Edge Function fallback`);
          } catch (fallbackErr) {
            console.error('[Push] Edge Function fallback also failed:', fallbackErr);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching Expo Push token:', e);
    }
  } else {
    console.log('Must use a physical device for Push Notifications');
  }

  return token;
}
