export const GEMINI_API_KEY_STORAGE_KEY = 'workstation_gemini_api_key';

/**
 * Retrieves the user's Google AI Studio API key from localStorage.
 */
export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Stores the user's Google AI Studio API key in localStorage.
 */
export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restrictive environments
  }
}

/**
 * Clears the user's Google AI Studio API key from localStorage.
 */
export function removeStoredGeminiApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
