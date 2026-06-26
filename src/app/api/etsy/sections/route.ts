import { NextResponse } from 'next/server';
import axios from 'axios';
import { getEtsyRefreshToken, saveEtsyRefreshToken, getEtsyShopId } from '@/lib/etsyTokenStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    const refreshToken = getEtsyRefreshToken();
    const shopId = getEtsyShopId() || process.env.ETSY_SHOP_ID;

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
    const newRefreshToken = tokenRes.data.refresh_token;
    if (newRefreshToken) {
      saveEtsyRefreshToken(newRefreshToken);
    }

    // 2. Fetch Shop Sections
    const sectionsRes = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}/sections`, {
      headers: {
        'x-api-key': `${apiKey}:${sharedSecret}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const sections = (sectionsRes.data.results || []).map((s: { shop_section_id: number; title: string }) => ({
      id: s.shop_section_id,
      title: s.title
    }));

    return NextResponse.json({ sections });
  } catch (err: unknown) {
    const error = err as { response?: { data?: unknown }, message?: string };
    console.error("Etsy Sections API Error:", error.response ? error.response.data : error.message);
    return NextResponse.json({ error: 'Failed to fetch Etsy sections' }, { status: 500 });
  }
}
