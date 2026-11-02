const STORAGE_KEY = 'workstation_openrouter_api_key';

export function getStoredOpenRouterApiKey(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(STORAGE_KEY) || ''; }
  catch { return ''; }
}

export function setStoredOpenRouterApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage can be unavailable in private browser contexts. */ }
}

export function removeStoredOpenRouterApiKey(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { /* Storage can be unavailable in private browser contexts. */ }
}
