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
      console.log('Push notification permission denied!');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
      if (!projectId) {
        console.warn('Project ID not found in app.config.ts / app.json');
      }

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      if (token) {
        const table = userType === "admin" ? "users" : "customer_portal_users";
        const { error } = await supabase.from(table).update({ push_token: token }).eq("id", userId);
        
        if (error) {
            console.error(`Failed to save push token for ${userType} ${userId}:`, error.message);
        } else {
            console.log(`Push token registered successfully for ${userType}`);
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
