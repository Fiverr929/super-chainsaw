import { NextResponse } from 'next/server';
import { resolveGeminiApiKey, verifyGeminiApiKey, missingApiKeyResponse } from '@/lib/geminiApi';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let bodyKey: string | undefined;
    try {
      const body = await request.json();
      bodyKey = body?.apiKey;
    } catch {
      // Body may be empty if passing via header
    }

    const apiKey = resolveGeminiApiKey(request, bodyKey);

    if (!apiKey) {
      return missingApiKeyResponse();
    }

    const result = await verifyGeminiApiKey(apiKey);

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error || 'Failed to verify Google AI Studio API key.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      model: result.model,
      message: 'Google AI Studio API key verified successfully.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : 'Internal Server Error during verification.',
      },
      { status: 500 }
    );
  }
}
