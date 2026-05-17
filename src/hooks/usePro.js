// ============================================================
// usePro — single source of truth for "is the current user Pro?".
// ============================================================
// Wraps RevenueCat customer info + offerings into one React hook so any
// screen can gate features behind the BioBalance Pro entitlement and read
// the real monthly price without touching the SDK directly. State stays
// in sync via RevenueCat's customer-info update listener.

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  configurePurchases,
  safeGetCustomerInfo,
  customerInfoHasPro,
  onCustomerInfoChanged,
  presentPaywallSheet,
  purchaseMonthly as purchaseMonthlyApi,
  fetchOfferings,
  restorePurchases as restoreApi,
} from '../api/purchasesClient';

export default function usePro() {
  const [isPro, setIsPro] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null); // result of fetchOfferings()
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);

  const applyInfo = useCallback((info) => {
    if (!mountedRef.current) return;
    setCustomerInfo(info || null);
    setIsPro(customerInfoHasPro(info));
  }, []);

  const refreshOfferings = useCallback(async () => {
    const off = await fetchOfferings();
    if (mountedRef.current) setOfferings(off);
    return off;
  }, []);

  const refresh = useCallback(async () => {
    const info = await safeGetCustomerInfo();
    applyInfo(info);
    return customerInfoHasPro(info);
  }, [applyInfo]);

  const openPaywall = useCallback(async () => {
    if (__DEV__) console.log('[usePro] openPaywall tapped');
    const res = await presentPaywallSheet();
    if (res?.customerInfo) applyInfo(res.customerInfo);
    else await refresh();
    return res;
  }, [applyInfo, refresh]);

  const purchaseMonthly = useCallback(async () => {
    if (__DEV__) console.log('[usePro] purchaseMonthly tapped');
    const res = await purchaseMonthlyApi();
    if (res?.customerInfo) applyInfo(res.customerInfo);
    else await refresh();
    return res;
  }, [applyInfo, refresh]);

  const restore = useCallback(async () => {
    if (__DEV__) console.log('[usePro] restore tapped');
    const res = await restoreApi();
    if (res?.customerInfo) applyInfo(res.customerInfo);
    return res;
  }, [applyInfo]);

  useEffect(() => {
    mountedRef.current = true;
    configurePurchases();

    let unsubscribe = () => {};
    (async () => {
      const info = await safeGetCustomerInfo();
      applyInfo(info);
      const off = await fetchOfferings();
      if (!mountedRef.current) return;
      setOfferings(off);
      setReady(true);
      unsubscribe = onCustomerInfoChanged(applyInfo);
    })();

    return () => {
      mountedRef.current = false;
      try { unsubscribe(); } catch (_) {}
    };
  }, [applyInfo]);

  return {
    isPro,
    customerInfo,
    offerings,
    monthlyPriceString: offerings?.monthlyPriceString || null,
    monthlyProductId: offerings?.monthlyProductId || null,
    ready,
    refresh,
    refreshOfferings,
    openPaywall,
    purchaseMonthly,
    restore,
  };
}
