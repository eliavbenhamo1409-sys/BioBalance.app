/** Lets App.js show ForceUpdateScreen when chat/API returns UPDATE_REQUIRED. */
let listener = null;

export function setUpdateRequiredListener(fn) {
  listener = typeof fn === 'function' ? fn : null;
}

export function emitUpdateRequired({ storeUrl, message, minVersion } = {}) {
  listener?.({ storeUrl, message, minVersion });
}
