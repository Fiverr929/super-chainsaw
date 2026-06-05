import { NextResponse } from 'next/server';
import axios from 'axios';
import { getEtsyRefreshToken, saveEtsyRefreshToken } from '@/lib/etsyTokenStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    const refreshToken = getEtsyRefreshToken();
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
    const newRefreshToken = tokenRes.data.refresh_token;
    if (newRefreshToken) {
      saveEtsyRefreshToken(newRefreshToken);
    }

    // 2. Fetch Shop Readiness State Definitions (Processing Profiles)
    const profilesRes = await axios.get(`https://api.etsy.com/v3/application/shops/${shopId}/readiness-state-definitions`, {
      headers: {
        'x-api-key': `${apiKey}:${sharedSecret}`,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const profiles = (profilesRes.data.results || []).map((p: {
      readiness_state_id: number;
      readiness_state: string;
      min_processing_days: number;
      max_processing_days: number;
      processing_days_display_label: string;
    }) => ({
      id: p.readiness_state_id,
      title: `${p.readiness_state} (${p.processing_days_display_label || (p.min_processing_days + '-' + p.max_processing_days + ' days')})`
    }));

    return NextResponse.json({ profiles });
  } catch (err: unknown) {
    const error = err as { response?: { data?: unknown }, message?: string };
    console.error("Etsy Processing Profiles API Error:", error.response ? error.response.data : error.message);
    return NextResponse.json({ error: 'Failed to fetch Etsy processing profiles' }, { status: 500 });
  }
}