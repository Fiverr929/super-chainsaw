import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    const refreshToken = process.env.ETSY_REFRESH_TOKEN;
    const shopId = process.env.ETSY_SHOP_ID;

    if (!apiKey || !sharedSecret || !refreshToken || !shopId) {
      return NextResponse.json({ error: 'Missing Etsy API credentials in .env.local' }, { status: 400 });
    }

    // 1. Get Access Token
    const tokenRes = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token',
      client_id: apiKey,
      refresh_token: refreshToken
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const accessToken = tokenRes.data.access_token;

    // 2. Fetch Shop Info
    const shopRes = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}`, {
      headers: {
        'x-api-key': `${apiKey}:${sharedSecret}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return NextResponse.json({ shop_name: shopRes.data.shop_name });
  } catch (err: unknown) {
    const error = err as { response?: { data?: unknown }, message?: string };
    console.error("Etsy API Error:", error.response ? error.response.data : error.message);
    return NextResponse.json({ error: 'Failed to fetch Etsy shop' }, { status: 500 });
  }
}
