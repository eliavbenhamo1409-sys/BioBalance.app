// ============================================================
// RevenueCat client — single point of contact for purchases.
// ============================================================
// • Configure Purchases at app start (Platform-specific API key).
// • Bind the Supabase user.id to the RevenueCat app user (logIn / logOut).
// • Read the active entitlement ("BioBalance Pro") to decide gating.
// • Present the dashboard-configured paywall via RevenueCatUI.
//
// The TEST API key below works in sandbox for both iOS and Android.
// When moving to production replace it with the real platform keys
// (typically two separate keys, one per store).

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

export const PRO_ENTITLEMENT = 'BioBalance Pro';

// Same test key works for iOS and Android in sandbox.
const REVENUECAT_KEYS = {
  ios: 'test_hIJbAShTPWrgmyNMOpbjcxvBwwN',
  android: 'test_hIJbAShTPWrgmyNMOpbjcxvBwwN',
};

let isConfigured = false;
let lastAppUserId = null;

/** Pick the right API key for the current platform. */
const apiKeyForPlatform = () => {
  if (Platform.OS === 'ios') return REVENUECAT_KEYS.ios;
  if (Platform.OS === 'android') return REVENUECAT_KEYS.android;
  return null;
};

/**
 * Configure Purchases. Safe to call multiple times — extra calls are no-ops.
 * Must be called once on app start before any other Purchases method.
 */
export const configurePurchases = () => {
  if (isConfigured) return;
  const apiKey = apiKeyForPlatform();
  if (!apiKey) {
    if (__DEV__) console.log('[purchases] no api key for platform, skipping');
    return;
  }
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    } else {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }
    Purchases.configure({ apiKey });
    isConfigured = true;
    if (__DEV__) console.log('[purchases] configured for', Platform.OS);
  } catch (e) {
    if (__DEV__) console.warn('[purchases] configure failed:', e?.message || e);
  }
};

/**
 * Tell RevenueCat which user is signed in. Use the Supabase user.id so the
 * same purchase survives reinstalls / device changes.
 */
export const loginToPurchases = async (userId) => {
  if (!isConfigured) configurePurchases();
  if (!userId) return null;
  if (lastAppUserId === userId) {
    return safeGetCustomerInfo();
  }
  try {
    const { customerInfo } = await Purchases.logIn(String(userId));
    lastAppUserId = userId;
    return customerInfo;
  } catch (e) {
    if (__DEV__) console.warn('[purchases] logIn failed:', e?.message || e);
    return null;
  }
};

/** Sign out of RevenueCat (call on Supabase sign-out). */
export const logoutFromPurchases = async () => {
  if (!isConfigured) return;
  try {
    await Purchases.logOut();
    lastAppUserId = null;
  } catch (e) {
    if (__DEV__) console.warn('[purchases] logOut failed:', e?.message || e);
  }
};

/** Returns customerInfo or null on any failure. Never throws. */
export const safeGetCustomerInfo = async () => {
  if (!isConfigured) configurePurchases();
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    if (__DEV__) console.warn('[purchases] getCustomerInfo failed:', e?.message || e);
    return null;
  }
};

/** True if the user currently has the Pro entitlement active. */
export const customerInfoHasPro = (customerInfo) => {
  const ent = customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT];
  return typeof ent !== 'undefined' && ent !== null;
};

/**
 * Subscribe to customer info updates. Returns an unsubscribe function.
 * RevenueCat fires this whenever entitlement state changes (purchase,
 * renewal, refund, etc.).
 */
export const onCustomerInfoChanged = (handler) => {
  if (!isConfigured) configurePurchases();
  try {
    Purchases.addCustomerInfoUpdateListener(handler);
    return () => {
      try {
        Purchases.removeCustomerInfoUpdateListener(handler);
      } catch (_) {}
    };
  } catch (e) {
    if (__DEV__) console.warn('[purchases] addListener failed:', e?.message || e);
    return () => {};
  }
};

/**
 * Show the paywall configured in the RevenueCat Dashboard.
 *
 * @returns {Promise<{ purchased: boolean, result: string }>}
 */
export const presentPaywallSheet = async () => {
  if (!isConfigured) configurePurchases();
  try {
    const result = await RevenueCatUI.presentPaywall();
    const purchased =
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED;
    return { purchased, result };
  } catch (e) {
    if (__DEV__) console.warn('[purchases] presentPaywall failed:', e?.message || e);
    return { purchased: false, result: 'ERROR' };
  }
};

/**
 * Same as presentPaywallSheet but gated on a required entitlement — if the
 * user already has it, returns immediately without showing the sheet.
 */
export const presentPaywallIfNeeded = async (entitlement = PRO_ENTITLEMENT) => {
  if (!isConfigured) configurePurchases();
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: entitlement,
    });
    const purchased =
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED ||
      result === PAYWALL_RESULT.NOT_PRESENTED;
    return { purchased, result };
  } catch (e) {
    if (__DEV__) console.warn('[purchases] presentPaywallIfNeeded failed:', e?.message || e);
    return { purchased: false, result: 'ERROR' };
  }
};

/** Restore previous purchases (Apple requires a Restore action in-app). */
export const restorePurchases = async () => {
  if (!isConfigured) configurePurchases();
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, customerInfo: info, isPro: customerInfoHasPro(info) };
  } catch (e) {
    if (__DEV__) console.warn('[purchases] restore failed:', e?.message || e);
    return { ok: false, customerInfo: null, isPro: false, error: e };
  }
};
