import { Platform } from 'react-native';
import { supabase } from './supabaseClient';
import { getInstalledAppVersion, isVersionOlder } from '../utils/compareAppVersion';

const DEFAULT_IOS_STORE_URL = 'https://apps.apple.com/app/id6756488694';
const DEFAULT_ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.naturebot.app';

const DEFAULT_MESSAGE_HE =
  'גרסה חדשה של BioBalance זמינה. יש לעדכן את האפליקציה כדי להמשיך להשתמש.';

/**
 * @returns {Promise<
 *   | { status: 'ok' }
 *   | { status: 'forceUpdate'; minVersion: string; storeUrl: string; message: string }
 * >}
 */
export async function checkAppVersionPolicy() {
  if (__DEV__) {
    return { status: 'ok' };
  }

  const installed = getInstalledAppVersion();
  const platform = Platform.OS === 'android' ? 'android' : 'ios';

  try {
    const { data, error } = await supabase
      .from('app_version_policy')
      .select('min_ios_version, min_android_version, ios_store_url, android_store_url, message_he')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) {
      if (__DEV__) console.warn('[appVersionPolicy] fetch failed, allowing app:', error?.message);
      return { status: 'ok' };
    }

    const minVersion =
      platform === 'android'
        ? String(data.min_android_version ?? '').trim()
        : String(data.min_ios_version ?? '').trim();

    if (!minVersion || !isVersionOlder(installed, minVersion)) {
      return { status: 'ok' };
    }

    const storeUrl =
      platform === 'android'
        ? String(data.android_store_url ?? '').trim() || DEFAULT_ANDROID_STORE_URL
        : String(data.ios_store_url ?? '').trim() || DEFAULT_IOS_STORE_URL;

    const message = String(data.message_he ?? '').trim() || DEFAULT_MESSAGE_HE;

    return { status: 'forceUpdate', minVersion, storeUrl, message };
  } catch (e) {
    if (__DEV__) console.warn('[appVersionPolicy] error, allowing app:', e?.message);
    return { status: 'ok' };
  }
}
