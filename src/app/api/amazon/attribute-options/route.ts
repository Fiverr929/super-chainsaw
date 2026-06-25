import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function signatureKey(secret: string, date: string, region: string): Buffer {
  const dateKey = crypto.createHmac('sha256', 'AWS4' + secret).update(date).digest();
  const regionKey = crypto.createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = crypto.createHmac('sha256', regionKey).update('execute-api').digest();
  return crypto.createHmac('sha256', serviceKey).update('aws4_request').digest();
}

function getEnumValues(field: unknown): string[] {
  const value = (field as { items?: { properties?: { value?: { anyOf?: Array<{ enum?: string[] }> } } } })?.items?.properties?.value;
  return value?.anyOf?.find(branch => Array.isArray(branch.enum))?.enum || [];
}

export async function GET() {
  try {
    const clientId = process.env.SP_API_CLIENT_ID; const clientSecret = process.env.SP_API_CLIENT_SECRET;
    const refreshToken = process.env.SP_API_REFRESH_TOKEN; const accessKey = process.env.SP_API_AWS_ACCESS_KEY;
    const secretKey = process.env.SP_API_AWS_SECRET_KEY; const sellerId = process.env.SP_API_SELLER_ID;
    const region = process.env.SP_API_REGION || 'eu';
    if (!clientId || !clientSecret || !refreshToken || !accessKey || !secretKey || !sellerId) return NextResponse.json({ error: 'Missing Amazon SP-API credentials.' }, { status: 400 });
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const accessToken = tokenResponse.data.access_token; const host = `sellingpartnerapi-${region}.amazon.com`;
    const requestPath = '/definitions/2020-09-01/productTypes/SHIRT';
    const query = new URLSearchParams({ sellerId, marketplaceIds: 'A21TJRUUN4KGV', productTypeVersion: 'LATEST', requirements: 'LISTING', requirementsEnforced: 'ENFORCED', locale: 'en_IN' }).toString();
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); const date = amzDate.slice(0, 8);
    const canonicalHeaders = `host:${host}\nx-amz-access-token:${accessToken}\nx-amz-date:${amzDate}\n`; const signedHeaders = 'host;x-amz-access-token;x-amz-date';
    const canonicalRequest = ['GET', requestPath, query, canonicalHeaders, signedHeaders, crypto.createHash('sha256').update('').digest('hex')].join('\n');
    const scope = `${date}/${region}/execute-api/aws4_request`; const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const signature = crypto.createHmac('sha256', signatureKey(secretKey, date, region)).update(toSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const definition = (await axios.get(`https://${host}${requestPath}?${query}`, { headers: { host, 'x-amz-access-token': accessToken, 'x-amz-date': amzDate, Authorization: authorization } })).data;
    const schema = (await axios.get(definition.schema.link.resource)).data; const properties = schema.properties || {};
    return NextResponse.json({ sport_type: getEnumValues(properties.sport_type), lifestyle: getEnumValues(properties.lifestyle), league_name: getEnumValues(properties.league_name), team_name: getEnumValues(properties.team_name), version: definition.productTypeVersion });
  } catch (error) {
    console.error('Amazon attribute options error:', axios.isAxiosError(error) ? error.response?.data || error.message : error);
    return NextResponse.json({ error: 'Failed to load Amazon SHIRT attribute options.' }, { status: 500 });
  }
}
