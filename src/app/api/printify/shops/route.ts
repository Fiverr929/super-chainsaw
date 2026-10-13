import { NextResponse } from 'next/server';
import { getPrintifyShops } from '@/lib/printify';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ shops: await getPrintifyShops() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Printify error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
