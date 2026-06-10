import Constants from 'expo-constants';

/** @returns {[number, number, number]} */
function parseSemver(version) {
  const parts = String(version ?? '')
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** True when `installed` is strictly older than `minimum`. Equal versions are allowed. */
export function isVersionOlder(installed, minimum) {
  const a = parseSemver(installed);
  const b = parseSemver(minimum);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

export function getInstalledAppVersion() {
  return String(Constants.expoConfig?.version ?? '0.0.0').trim();
}
