import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const taxonomyId = searchParams.get('taxonomy_id');

  if (!taxonomyId) {
    return NextResponse.json({ error: 'taxonomy_id is required' }, { status: 400 });
  }

  const apiKey = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;

  if (!apiKey || !sharedSecret) {
    return NextResponse.json({ error: 'Missing Etsy API credentials in .env.local' }, { status: 400 });
  }

  try {
    const res = await axios.get(`https://api.etsy.com/v3/application/seller-taxonomy/nodes/${taxonomyId}/properties`, {
      headers: {
        'x-api-key': `${apiKey}:${sharedSecret}`,
        'Content-Type': 'application/json'
      }
    });

    return NextResponse.json(res.data);
  } catch (err: unknown) {
    const error = err as { response?: { data?: unknown }, message?: string };
    console.error("Taxonomy fetch failed:", error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch taxonomy properties' }, { status: 500 });
  }
}
