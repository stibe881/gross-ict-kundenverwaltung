import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
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

// Debug flag — set to true to show alerts on push registration (for TestFlight debugging)
const PUSH_DEBUG = true;

function debugAlert(title: string, msg: string) {
  if (PUSH_DEBUG && Platform.OS !== 'web') {
    Alert.alert(`[Push Debug] ${title}`, msg);
  }
}

export async function registerForPushNotificationsAsync(userType: "admin" | "customer", userId: string, userEmail?: string) {
  let token;

  const executionEnv = Constants.executionEnvironment || 'unknown';
  debugAlert('Start', `userType=${userType}\nuserId=${userId}\nenv=${executionEnv}\nisDevice=${Device.isDevice}`);

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
      debugAlert('Permission', `NOT granted (status: ${finalStatus})`);
      console.log('[Push] Permission not granted');
      return null;
    }
    debugAlert('Permission', `Granted ✅`);

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId
        ?? Constants?.easConfig?.projectId
        ?? "f1e370f0-264c-4354-bec5-3295208bfd21";

      debugAlert('ProjectId', `${projectId}\nexpoConfig: ${JSON.stringify(Constants?.expoConfig?.extra?.eas)}\neasConfig: ${JSON.stringify(Constants?.easConfig)}`);

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      debugAlert('Token', `${token}`);

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
            debugAlert('Save FAILED', `Edge: ${saveError.message}\nTrying direct...`);
            const { error: directError } = await supabase
              .from(userType === "admin" ? "users" : "customer_portal_users")
              .update({ push_token: token })
              .eq("id", userId);
            if (directError) {
              debugAlert('Direct FAILED', directError.message);
            } else {
              debugAlert('Direct OK', 'Token saved via direct update');
            }
          } else {
            debugAlert('Save OK ✅', `Result: ${JSON.stringify(saveResult)}`);
          }
        } catch (err: any) {
          debugAlert('Save ERROR', err?.message || String(err));
        }
      }
    } catch (e: any) {
      debugAlert('Token ERROR', e?.message || String(e));
      console.error('[Push] Error fetching Expo Push token:', e);
    }
  } else {
    debugAlert('Skip', `Not a physical device (isDevice=${Device.isDevice})`);
  }

  return token;
}
