import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const key = request.headers.get('x-openrouter-api-key')?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: 'Enter an OpenRouter API key first.' }, { status: 400 });
  try {
    const response = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      return NextResponse.json({ error: 'OpenRouter rejected this key (401). Check that it is a current API key from your OpenRouter workspace; create a new key if needed.' }, { status: 401 });
    }
    if (!response.ok) return NextResponse.json({ error: `OpenRouter could not verify the key (${response.status}). Try again shortly.` }, { status: 502 });
    const result = await response.json() as { data?: { is_management_key?: boolean; is_provisioning_key?: boolean } };
    if (!result.data) return NextResponse.json({ error: 'OpenRouter returned an incomplete key verification response.' }, { status: 502 });
    if (result.data.is_management_key) return NextResponse.json({ error: 'This is a management key. Create a standard API key in an OpenRouter workspace for image generation.' }, { status: 400 });
    if (result.data.is_provisioning_key) return NextResponse.json({ error: 'This is a provisioning key. Create a standard API key in an OpenRouter workspace for image generation.' }, { status: 400 });
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ error: 'Could not reach OpenRouter to verify the key. Try again shortly.' }, { status: 502 });
  }
}
