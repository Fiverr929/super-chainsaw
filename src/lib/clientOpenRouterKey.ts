import { browserStorage } from './browserStorage.ts';
const STORAGE_KEY = 'workstation_openrouter_api_key';

export function getStoredOpenRouterApiKey(): string {
  if (typeof window === 'undefined') return '';
  try { return browserStorage.getItem(STORAGE_KEY) || ''; }
  catch { return ''; }
}

export function setStoredOpenRouterApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key.trim()) browserStorage.setItem(STORAGE_KEY, key.trim());
    else browserStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage can be unavailable in private browser contexts. */ }
}

export function removeStoredOpenRouterApiKey(): void {
  if (typeof window === 'undefined') return;
  try { browserStorage.removeItem(STORAGE_KEY); }
  catch { /* Storage can be unavailable in private browser contexts. */ }
}
