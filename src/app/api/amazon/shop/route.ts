import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
type MarketplaceParticipation = {
  marketplace?: { name?: string };
};

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', "AWS4" + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update("aws4_request").digest();
  return kSigning;
}

function getSigV4Headers(
  method: string,
  path: string,
  queryParams: Record<string, string>,
  host: string,
  awsAccessKey: string,
  awsSecretKey: string,
  region: string
) {
  const service = 'execute-api';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.substring(0, 8);

  const canonicalUri = path;
  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');

  const canonicalRequest = [
    method,
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const signingKey = getSignatureKey(awsSecretKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${awsAccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'x-amz-date': amzDate,
    'Authorization': authorizationHeader
  };
}

export async function GET() {
  try {
    const clientID = process.env.SP_API_CLIENT_ID;
    const clientSecret = process.env.SP_API_CLIENT_SECRET;
    const refreshToken = process.env.SP_API_REFRESH_TOKEN;
    const awsAccessKey = process.env.SP_API_AWS_ACCESS_KEY;
    const awsSecretKey = process.env.SP_API_AWS_SECRET_KEY;
    const region = process.env.SP_API_REGION || 'eu';
    const sellerId = process.env.SP_API_SELLER_ID;

    if (!clientID || !clientSecret || !refreshToken || !awsAccessKey || !awsSecretKey || !sellerId) {
      return NextResponse.json({ error: 'Missing Amazon SP-API credentials in .env.local' }, { status: 400 });
    }

    // 1. Get Access Token
    const tokenRes = await axios.post('https://api.amazon.com/auth/o2/token', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientID,
      client_secret: clientSecret
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const accessToken = tokenRes.data.access_token;

    // 2. Fetch Marketplace Participations to verify identity and get shop name
    const host = `sellingpartnerapi-${region}.amazon.com`;
    const path = '/sellers/v1/marketplaceParticipations';
    const sigHeaders = getSigV4Headers('GET', path, {}, host, awsAccessKey, awsSecretKey, region);

    const sellersRes = await axios.get(`https://${host}${path}`, {
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...sigHeaders
      }
    });

    const participations: MarketplaceParticipation[] = sellersRes.data.payload || [];
    let shopName = `Amazon Store (${sellerId})`;

    if (participations.length > 0) {
      const activePart = participations.find(p => p.marketplace?.name) || participations[0];
      if (activePart?.marketplace?.name) {
        shopName = `Amazon Store (${activePart.marketplace.name})`;
      }
    }

    return NextResponse.json({ 
      shop_name: shopName, 
      seller_id: sellerId,
      refresh_token: refreshToken,
      region: region
    });
  } catch (err: unknown) {
    const error = err as { response?: { data?: unknown }, message?: string };
    console.error("Amazon API Error:", error.response ? error.response.data : error.message);
    return NextResponse.json({ error: 'Failed to verify Amazon shop' }, { status: 500 });
  }
}
