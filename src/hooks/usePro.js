// ============================================================
// usePro — single source of truth for "is the current user Pro?".
// ============================================================
// Wraps RevenueCat customer info into a tiny React hook so any screen
// can gate features behind the BioBalance Pro entitlement without
// touching the SDK directly. The state stays in sync via RevenueCat's
// customer-info update listener.

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  configurePurchases,
  safeGetCustomerInfo,
  customerInfoHasPro,
  onCustomerInfoChanged,
  presentPaywallSheet,
  restorePurchases as restoreApi,
} from '../api/purchasesClient';

export default function usePro() {
  const [isPro, setIsPro] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);

  const applyInfo = useCallback((info) => {
    if (!mountedRef.current) return;
    setCustomerInfo(info || null);
    setIsPro(customerInfoHasPro(info));
  }, []);

  const refresh = useCallback(async () => {
    const info = await safeGetCustomerInfo();
    applyInfo(info);
    return customerInfoHasPro(info);
  }, [applyInfo]);

  const openPaywall = useCallback(async () => {
    const res = await presentPaywallSheet();
    await refresh();
    return res;
  }, [refresh]);

  const restore = useCallback(async () => {
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
      if (mountedRef.current) setReady(true);
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
    ready,
    refresh,
    openPaywall,
    restore,
  };
}
