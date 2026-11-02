import { browserStorage } from './browserStorage.ts';
export const GEMINI_API_KEY_STORAGE_KEY = 'workstation_gemini_api_key';

/**
 * Retrieves the user's Google AI Studio API key from browserStorage.
 */
export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return browserStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Stores the user's Google AI Studio API key in browserStorage.
 */
export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = key.trim();
    if (trimmed) {
      browserStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    } else {
      browserStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restrictive environments
  }
}

/**
 * Clears the user's Google AI Studio API key from browserStorage.
 */
export function removeStoredGeminiApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    browserStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
