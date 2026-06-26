import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { saveEtsyRefreshToken } from '@/lib/etsyTokenStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const apiKey = process.env.ETSY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing ETSY_API_KEY in environment' }, { status: 400 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    console.error("Etsy OAuth Error:", error);
    return NextResponse.json({ error: `Etsy returned an error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided by Etsy' }, { status: 400 });
  }

  // Retrieve the PKCE code verifier from cookies
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get('etsy_code_verifier')?.value;

  if (!codeVerifier) {
    return NextResponse.json({ error: 'Missing PKCE code verifier in cookies. Session may have expired.' }, { status: 400 });
  }

  // Determine redirect URI
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/etsy/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenRes = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'authorization_code',
      client_id: apiKey,
      redirect_uri: redirectUri,
      code: code,
      code_verifier: codeVerifier,
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const newRefreshToken = tokenRes.data.refresh_token;
    const accessToken = tokenRes.data.access_token;
    
    let shopId: string | undefined = undefined;

    // Dynamically fetch the shop ID from the authorized access token
    if (accessToken) {
      try {
        // Etsy access tokens are in the format {user_id}.{base64}
        const userId = accessToken.split('.')[0];
        
        // Fetch the user's shops to get the shop ID
        const shopRes = await axios.get(`https://api.etsy.com/v3/application/users/${userId}/shops`, {
          headers: {
            'x-api-key': apiKey,
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (shopRes.data && shopRes.data.shop_id) {
          shopId = shopRes.data.shop_id.toString();
        }
      } catch (err) {
        console.error("Failed to dynamically fetch Etsy shop ID during OAuth callback:", err);
      }
    }

    if (newRefreshToken) {
      saveEtsyRefreshToken(newRefreshToken, shopId);
    }

    // Redirect the user back to the main app dashboard with a success flag
    return NextResponse.redirect(`${protocol}://${host}/?etsy_connected=true`);
  } catch (err: unknown) {
    const apiError = err as { response?: { data?: unknown }, message?: string };
    console.error("Failed to exchange Etsy authorization code:", apiError.response ? apiError.response.data : apiError.message);
    return NextResponse.json({ error: 'Failed to authenticate with Etsy.' }, { status: 500 });
  }
}
