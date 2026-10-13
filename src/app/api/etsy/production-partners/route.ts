import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getEtsyRefreshToken, getEtsyShopId, saveEtsyRefreshToken } from '@/lib/etsyTokenStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = process.env.ETSY_API_KEY;
    const sharedSecret = process.env.ETSY_SHARED_SECRET;
    const refreshToken = getEtsyRefreshToken();
    const shopId = getEtsyShopId() || process.env.ETSY_SHOP_ID;
    if (!apiKey || !sharedSecret || !refreshToken || !shopId) {
      return NextResponse.json({ error: 'Etsy shop is not connected' }, { status: 400 });
    }

    const tokenResponse = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: apiKey, refresh_token: refreshToken }),
      cache: 'no-store'
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.error || 'Could not refresh Etsy access');
    if (token.refresh_token) saveEtsyRefreshToken(token.refresh_token);

    const response = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}/production-partners`, {
      headers: { 'x-api-key': `${apiKey}:${sharedSecret}`, Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load Etsy production partners');
    return NextResponse.json({
      partners: (result.results || []).map((partner: { production_partner_id: number; partner_name: string; location?: string }) => ({
        id: partner.production_partner_id,
        name: partner.partner_name,
        location: partner.location || ''
      }))
    });
  } catch (error) {
    console.error('Etsy production partners API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown Etsy API error';
    try {
      fs.writeFileSync(path.join(process.cwd(), 'latest_error.json'), JSON.stringify({
        route: '/api/etsy/production-partners',
        timestamp: new Date().toISOString(),
        error: message
      }, null, 2));
    } catch (logError) {
      console.error('Could not write latest_error.json:', logError);
    }
    return NextResponse.json({ error: `Failed to load Etsy production partners: ${message}` }, { status: 500 });
  }
}
