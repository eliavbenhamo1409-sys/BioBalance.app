// ============================================================
// RevenueCat client — single point of contact for purchases.
// ============================================================
// Responsibilities:
//   • Configure Purchases at app start with the production iOS key
//     (`appl_...`). The `test_...` key crashes on store builds by design.
//   • Bind the Supabase user.id to the RevenueCat app user via logIn/logOut.
//   • Read the active entitlement "BioBalance Pro" to decide gating.
//   • Fetch the current Offering and the `$rc_monthly` package so the
//     UI can show the real RevenueCat price.
//   • Present the dashboard-configured paywall via RevenueCatUI.
//   • Provide loud, structured logs at every step so it's easy to debug
//     "why is the paywall empty?" from a TestFlight session.

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

/** Entitlement identifier as defined in the RevenueCat Dashboard. */
export const PRO_ENTITLEMENT = 'BioBalance Pro';

/** Expected package identifier in the current Offering. */
export const MONTHLY_PACKAGE_ID = '$rc_monthly';

/** Expected App Store product ID attached to the monthly package. */
export const MONTHLY_PRODUCT_ID = 'biobalance_monthly';

// Production keys from RevenueCat Dashboard → Project settings → API keys.
// iOS uses an `appl_...` key (Apple App Store). Android still needs a real
// `goog_...` key from Google Play; the iOS key is used as a non-crashing
// fallback for now so the SDK stays initialised on Android dev builds.
const REVENUECAT_KEYS = {
  ios: 'appl_IuXblSyhlrfDERNEqYWdkRptXRe',
  android: 'appl_IuXblSyhlrfDERNEqYWdkRptXRe',
};

let isConfigured = false;
let lastAppUserId = null;

const TAG = '[purchases]';
const log = (...args) => console.log(TAG, ...args);
const warn = (...args) => console.warn(TAG, ...args);

/** Compact summary of a customerInfo object — easier to read in logs. */
const summarizeCustomerInfo = (info) => {
  if (!info) return null;
  const active = info?.entitlements?.active || {};
  const all = info?.entitlements?.all || {};
  return {
    originalAppUserId: info.originalAppUserId,
    appUserId: info.appUserId || info.originalAppUserId,
    activeEntitlements: Object.keys(active),
    proIsActive: !!active[PRO_ENTITLEMENT],
    proExpiration: active[PRO_ENTITLEMENT]?.expirationDate || null,
    allEntitlements: Object.keys(all),
    activeSubscriptions: info.activeSubscriptions || [],
    nonSubscriptionPurchases:
      info.nonSubscriptionTransactions?.length || 0,
  };
};

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
    warn('no api key for platform, skipping', Platform.OS);
    return;
  }
  const keyKind = apiKey.startsWith('appl_')
    ? 'iOS production (appl_)'
    : apiKey.startsWith('goog_')
      ? 'Android production (goog_)'
      : apiKey.startsWith('test_')
        ? 'TEST (will crash on production builds!)'
        : 'unknown';
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    isConfigured = true;
    log('configured', { platform: Platform.OS, keyKind, prefix: apiKey.slice(0, 5) });
  } catch (e) {
    warn('configure failed:', e?.message || e);
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
    log('logIn skipped — already bound to', userId);
    return safeGetCustomerInfo();
  }
  try {
    const { customerInfo, created } = await Purchases.logIn(String(userId));
    lastAppUserId = userId;
    log('logIn ok', { userId, created, info: summarizeCustomerInfo(customerInfo) });
    return customerInfo;
  } catch (e) {
    warn('logIn failed:', e?.message || e);
    return null;
  }
};

/** Sign out of RevenueCat (call on Supabase sign-out). */
export const logoutFromPurchases = async () => {
  if (!isConfigured) return;
  try {
    await Purchases.logOut();
    lastAppUserId = null;
    log('logOut ok');
  } catch (e) {
    warn('logOut failed:', e?.message || e);
  }
};

/** Returns customerInfo or null on any failure. Never throws. */
export const safeGetCustomerInfo = async () => {
  if (!isConfigured) configurePurchases();
  try {
    const info = await Purchases.getCustomerInfo();
    log('getCustomerInfo', summarizeCustomerInfo(info));
    return info;
  } catch (e) {
    warn('getCustomerInfo failed:', e?.message || e);
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
    const wrapped = (info) => {
      log('customerInfoUpdate', summarizeCustomerInfo(info));
      try { handler(info); } catch (_) {}
    };
    Purchases.addCustomerInfoUpdateListener(wrapped);
    return () => {
      try { Purchases.removeCustomerInfoUpdateListener(wrapped); } catch (_) {}
    };
  } catch (e) {
    warn('addListener failed:', e?.message || e);
    return () => {};
  }
};

// ------------------------------------------------------------
// Offerings
// ------------------------------------------------------------

/**
 * Fetch the current Offering and find the expected monthly package.
 * Logs *everything* about what came back from the dashboard so it's
 * obvious whether the dashboard wiring is correct.
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   currentOffering: object|null,
 *   monthlyPackage: object|null,
 *   monthlyPriceString: string|null,
 *   monthlyProductId: string|null,
 *   error?: string,
 * }>}
 */
export const fetchOfferings = async () => {
  if (!isConfigured) configurePurchases();
  try {
    const offerings = await Purchases.getOfferings();
    const all = offerings?.all || {};
    const current = offerings?.current || null;

    log('getOfferings', {
      allOfferingIds: Object.keys(all),
      currentOfferingId: current?.identifier || null,
      currentPackageCount: current?.availablePackages?.length ?? 0,
    });

    if (!current) {
      warn('no current offering — set one as Current in the Dashboard.');
      return {
        ok: false,
        currentOffering: null,
        monthlyPackage: null,
        monthlyPriceString: null,
        monthlyProductId: null,
        error: 'NO_CURRENT_OFFERING',
      };
    }

    const packages = current.availablePackages || [];
    log('current offering packages', packages.map((p) => ({
      identifier: p.identifier,
      packageType: p.packageType,
      productId: p.product?.identifier,
      priceString: p.product?.priceString,
      title: p.product?.title,
    })));

    const monthly =
      current.monthly ||
      packages.find((p) => p.identifier === MONTHLY_PACKAGE_ID) ||
      packages.find((p) => p.packageType === 'MONTHLY') ||
      null;

    if (!monthly) {
      warn(`no ${MONTHLY_PACKAGE_ID} package — add it to the current offering.`);
      return {
        ok: false,
        currentOffering: current,
        monthlyPackage: null,
        monthlyPriceString: null,
        monthlyProductId: null,
        error: 'NO_MONTHLY_PACKAGE',
      };
    }

    const productId = monthly.product?.identifier || null;
    const priceString = monthly.product?.priceString || null;
    log('monthly package resolved', {
      packageIdentifier: monthly.identifier,
      packageType: monthly.packageType,
      productId,
      priceString,
      currency: monthly.product?.currencyCode,
      expectedProductId: MONTHLY_PRODUCT_ID,
      productIdMatches: productId === MONTHLY_PRODUCT_ID,
    });

    if (productId !== MONTHLY_PRODUCT_ID) {
      warn(
        `monthly package is attached to product "${productId}" but app expects "${MONTHLY_PRODUCT_ID}".`,
      );
    }

    return {
      ok: true,
      currentOffering: current,
      monthlyPackage: monthly,
      monthlyPriceString: priceString,
      monthlyProductId: productId,
    };
  } catch (e) {
    warn('getOfferings failed:', e?.message || e);
    return {
      ok: false,
      currentOffering: null,
      monthlyPackage: null,
      monthlyPriceString: null,
      monthlyProductId: null,
      error: e?.message || String(e),
    };
  }
};

// ------------------------------------------------------------
// Purchase actions
// ------------------------------------------------------------

const labelPaywallResult = (result) => {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED: return 'PURCHASED';
    case PAYWALL_RESULT.RESTORED: return 'RESTORED';
    case PAYWALL_RESULT.CANCELLED: return 'CANCELLED';
    case PAYWALL_RESULT.NOT_PRESENTED: return 'NOT_PRESENTED';
    case PAYWALL_RESULT.ERROR: return 'ERROR';
    default: return String(result);
  }
};

/**
 * Show the paywall configured in the RevenueCat Dashboard for the current
 * Offering. The paywall picks the packages itself — we don't pass anything.
 *
 * @returns {Promise<{ purchased: boolean, result: string, customerInfo: object|null }>}
 */
export const presentPaywallSheet = async () => {
  if (!isConfigured) configurePurchases();
  log('presentPaywall: opening sheet (uses Current Offering)');
  try {
    const result = await RevenueCatUI.presentPaywall();
    const label = labelPaywallResult(result);
    log('presentPaywall result', label);
    const purchased =
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED;

    // Always re-read customer info after the sheet closes so we know the
    // entitlement state for sure.
    const info = await safeGetCustomerInfo();
    log('post-paywall entitlement check', {
      proIsActive: customerInfoHasPro(info),
      activeEntitlements: Object.keys(info?.entitlements?.active || {}),
    });

    return { purchased, result: label, customerInfo: info };
  } catch (e) {
    warn('presentPaywall failed:', e?.message || e);
    return { purchased: false, result: 'ERROR', customerInfo: null };
  }
};

/**
 * Direct programmatic purchase of the monthly package, without showing the
 * dashboard paywall. Useful for a custom in-app paywall UI.
 *
 * @returns {Promise<{ purchased: boolean, result: string, customerInfo: object|null }>}
 */
export const purchaseMonthly = async () => {
  if (!isConfigured) configurePurchases();
  log('purchaseMonthly: fetching package…');
  const offerings = await fetchOfferings();
  if (!offerings.ok || !offerings.monthlyPackage) {
    return {
      purchased: false,
      result: offerings.error || 'NO_PACKAGE',
      customerInfo: null,
    };
  }
  log('purchaseMonthly: calling Purchases.purchasePackage', {
    productId: offerings.monthlyProductId,
    priceString: offerings.monthlyPriceString,
  });
  try {
    const res = await Purchases.purchasePackage(offerings.monthlyPackage);
    const info = res?.customerInfo || null;
    const purchased = customerInfoHasPro(info);
    log('purchaseMonthly ok', {
      productIdentifier: res?.productIdentifier,
      purchased,
      info: summarizeCustomerInfo(info),
    });
    return { purchased, result: 'PURCHASED', customerInfo: info };
  } catch (e) {
    if (e?.userCancelled) {
      log('purchaseMonthly cancelled by user');
      return { purchased: false, result: 'CANCELLED', customerInfo: null };
    }
    warn('purchaseMonthly failed:', e?.message || e, e?.userInfo || '');
    return {
      purchased: false,
      result: e?.code || 'ERROR',
      customerInfo: null,
    };
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
    const label = labelPaywallResult(result);
    log('presentPaywallIfNeeded result', label, { entitlement });
    const purchased =
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED ||
      result === PAYWALL_RESULT.NOT_PRESENTED;
    return { purchased, result: label };
  } catch (e) {
    warn('presentPaywallIfNeeded failed:', e?.message || e);
    return { purchased: false, result: 'ERROR' };
  }
};

/** Restore previous purchases (Apple requires a Restore action in-app). */
export const restorePurchases = async () => {
  if (!isConfigured) configurePurchases();
  log('restorePurchases: starting');
  try {
    const info = await Purchases.restorePurchases();
    const isPro = customerInfoHasPro(info);
    log('restorePurchases done', { isPro, info: summarizeCustomerInfo(info) });
    return { ok: true, customerInfo: info, isPro };
  } catch (e) {
    warn('restore failed:', e?.message || e);
    return { ok: false, customerInfo: null, isPro: false, error: e };
  }
};
