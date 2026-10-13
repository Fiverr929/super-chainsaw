import axios from 'axios';
import { getEtsyRefreshToken, saveEtsyRefreshToken, getEtsyShopId } from '@/lib/etsyTokenStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const listingId = new URL(request.url).searchParams.get('listingId');
  if (!listingId || !/^[1-9]\d*$/.test(listingId)) return Response.json({ error: 'Invalid Etsy listing ID.' }, { status: 400 });
  const apiKey = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;
  const refreshToken = getEtsyRefreshToken();
  if (!apiKey || !sharedSecret || !refreshToken) return Response.json({ error: 'Connect Etsy before syncing listing status.' }, { status: 400 });
  try {
    const token = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token', client_id: apiKey, refresh_token: refreshToken,
    }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (token.data.refresh_token) saveEtsyRefreshToken(token.data.refresh_token);
    const listing = await axios.get(`https://api.etsy.com/v3/application/listings/${listingId}`, {
      headers: { 'x-api-key': `${apiKey}:${sharedSecret}`, Authorization: `Bearer ${token.data.access_token}` },
    });
    const connectedShop = getEtsyShopId() || process.env.ETSY_SHOP_ID;
    if (connectedShop && String(listing.data.shop_id) !== String(connectedShop)) {
      return Response.json({ error: 'This listing does not belong to the connected Etsy shop.' }, { status: 409 });
    }
    const remoteState = String(listing.data.state || '').toLowerCase();
    const status = remoteState === 'active' ? 'Published' : remoteState === 'draft' ? 'Draft' : 'Inactive';
    return Response.json({ listingId, remoteState, status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const details = axios.isAxiosError(error) ? error.response?.data : error;
    console.error('Etsy listing status sync failed:', details);
    return Response.json({ error: 'Could not verify this listing with Etsy. Local status was left unchanged.' }, { status: 502 });
  }
}
