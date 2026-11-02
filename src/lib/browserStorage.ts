declare global { interface Window { __workstationStorageScope?: string | null; __workstationManualAccount?:boolean } }
export function browserStorageKey(key: string) {
  const scope = typeof window !== 'undefined' ? window.__workstationStorageScope : null;
  return scope ? `cloud-v1:${scope}:${key}` : key;
}
// Account-scoped caches start fresh without importing legacy browser data.
export const browserStorage = {
  getItem(key: string) { return window.localStorage.getItem(browserStorageKey(key)); },
  setItem(key: string, value: string) { window.localStorage.setItem(browserStorageKey(key), value); },
  removeItem(key: string) { window.localStorage.removeItem(browserStorageKey(key)); },
};
