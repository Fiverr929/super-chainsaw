import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function base64URLEncode(str: Buffer) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function GET(request: Request) {
  const apiKey = process.env.ETSY_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing ETSY_API_KEY in environment' }, { status: 400 });
  }

  // Determine redirect URI based on the request host
  const host = request.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/etsy/callback`;

  // 1. Generate PKCE code verifier (random 32 byte string, base64url encoded)
  const verifierBuffer = crypto.randomBytes(32);
  const codeVerifier = base64URLEncode(verifierBuffer);

  // 2. Generate PKCE code challenge (SHA256 of verifier, base64url encoded)
  const challengeBuffer = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(challengeBuffer);

  const state = crypto.randomBytes(16).toString('hex'); // Prevent CSRF

  // 3. Store the one-time verifier and state for the callback.
  const cookieStore = await cookies();
  const oauthCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  };
  cookieStore.set('etsy_code_verifier', codeVerifier, oauthCookieOptions);
  cookieStore.set('etsy_oauth_state', state, oauthCookieOptions);

  // 4. Construct the Etsy OAuth URL
  // Scopes needed: shops_r, shops_w, listings_r, listings_w, listings_d
  const scopes = 'shops_r shops_w listings_r listings_w listings_d';
  const searchParams = new URLSearchParams({
    response_type: 'code',
    client_id: apiKey,
    redirect_uri: redirectUri,
    scope: scopes,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  const etsyAuthUrl = `https://www.etsy.com/oauth/connect?${searchParams.toString()}`;

  // Redirect user to Etsy
  return NextResponse.redirect(etsyAuthUrl);
}
