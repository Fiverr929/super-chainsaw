export const AI_STUDIO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export interface GeminiApiOptions {
  apiKey: string;
  model?: string;
  contents: unknown[];
  systemInstruction?: string;
  generationConfig?: {
    temperature?: number;
    responseMimeType?: string;
    maxOutputTokens?: number;
    thinkingConfig?: {
      thinkingLevel?: string;
    };
    imageConfig?: {
      imageSize?: string;
      aspectRatio?: string;
    };
    [key: string]: unknown;
  };
  timeoutMs?: number;
}

export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  [key: string]: unknown;
}

/**
 * Resolves the Google AI Studio API key in order of precedence:
 * 1. Request Header: `x-gemini-api-key` or `x-goog-api-key`
 * 2. Explicit body/parameter key passed in
 * 3. Environment variables: `GEMINI_API_KEY` or `GOOGLE_API_KEY`
 */
export function resolveGeminiApiKey(request?: Request, fallbackKey?: string): string | null {
  if (request && typeof request.headers?.get === 'function') {
    const headerKey = request.headers.get('x-gemini-api-key') || request.headers.get('x-goog-api-key');
    if (headerKey && headerKey.trim() !== '') {
      return headerKey.trim();
    }
  }

  if (fallbackKey && typeof fallbackKey === 'string' && fallbackKey.trim() !== '') {
    return fallbackKey.trim();
  }

  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey && envKey.trim() !== '') {
    return envKey.trim();
  }

  return null;
}

/**
 * Returns a standardized JSON 400 response when no Google AI Studio key is provided.
 */
export function missingApiKeyResponse() {
  return Response.json(
    {
      error: 'Google AI Studio API Key is missing. Please add your Gemini API Key in Settings (Sidebar -> Settings -> Google AI Studio) or configure GEMINI_API_KEY.',
      code: 'MISSING_API_KEY',
    },
    { status: 400 }
  );
}

/**
 * Calls Google AI Studio generateContent endpoint using the user's API key.
 */
export async function callGeminiGenerateContent(options: GeminiApiOptions): Promise<GeminiApiResponse> {
  const { apiKey, model = DEFAULT_GEMINI_MODEL, contents, systemInstruction, generationConfig, timeoutMs = 120000 } = options;

  if (!apiKey) {
    throw new Error('Google AI Studio API key is required');
  }

  const url = `${AI_STUDIO_BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const bodyPayload: Record<string, unknown> = {
    contents,
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (generationConfig) {
    bodyPayload.generationConfig = generationConfig;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let data: GeminiApiResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Google AI Studio returned non-JSON response (status ${response.status}): ${responseText.substring(0, 300)}`);
    }

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || responseText;
      if (response.status === 400 && errMsg.includes('API key not valid')) {
        throw new Error('Invalid Google AI Studio API Key. Please verify your key at https://aistudio.google.com/app/apikey and re-enter it in Settings.');
      }
      if (response.status === 403) {
        throw new Error(`Google AI Studio permission denied: ${errMsg}`);
      }
      if (response.status === 429) {
        throw new Error(`Google AI Studio rate limit or quota exceeded: ${errMsg}`);
      }
      throw new Error(`Google AI Studio error (${response.status}): ${errMsg}`);
    }

    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Google AI Studio request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fast verification check for a Google AI Studio API key.
 */
export async function verifyGeminiApiKey(apiKey: string): Promise<{ valid: boolean; model?: string; error?: string }> {
  try {
    const data = await callGeminiGenerateContent({
      apiKey,
      model: DEFAULT_GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      generationConfig: { maxOutputTokens: 5, temperature: 0.1 },
      timeoutMs: 15000,
    });

    if (data.candidates && data.candidates.length > 0) {
      return { valid: true, model: DEFAULT_GEMINI_MODEL };
    }
    return { valid: false, error: 'Google AI Studio returned an unexpected empty response.' };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
