import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'digital';
    
    let baseDir = 'listings';
    if (type === 'physical') {
      baseDir = 'listings-physical';
    } else if (type === 'amazon') {
      baseDir = 'listings-amazon';
    }
    
    const listingsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', baseDir);
    
    // Create the directory if it doesn't exist yet
    if (!fs.existsSync(listingsDir)) {
      fs.mkdirSync(listingsDir, { recursive: true });
      return NextResponse.json({ folders: [] });
    }

    const entries = fs.readdirSync(listingsDir, { withFileTypes: true });
    
    // Filter for directories only
    const folders = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .filter(entry => {
        if (!entry.name.startsWith('product-')) return true;
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(listingsDir, entry.name, 'manifest.json'), 'utf8')) as { productId?: unknown; channel?: unknown; productRevision?: unknown };
          const id = entry.name.slice('product-'.length);
          const expectedChannel = type === 'amazon' ? 'amazon' : 'etsy';
          return manifest.productId === id && manifest.channel === expectedChannel && typeof manifest.productRevision === 'number';
        } catch { return false; }
      })
      .map(entry => entry.name);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error scanning listings directory:', error);
    return NextResponse.json({ error: 'Failed to scan directory' }, { status: 500 });
  }
}
