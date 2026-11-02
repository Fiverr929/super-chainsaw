import { NextResponse } from 'next/server';
import fs from '../../../../lib/workspaceFs.ts';
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
    if (!await exists(listingsDir)) {
      await fs.mkdir(listingsDir, { recursive: true });
      return NextResponse.json({ folders: [] });
    }

    const entries = await fs.readdir(listingsDir, { withFileTypes: true });
    
    // Filter for directories only
    const folders: string[] = [];
    for (const entry of entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))) {
        if (!entry.name.startsWith('product-')) { folders.push(entry.name); continue; }
        try {
          const manifest = JSON.parse(await fs.readFile(path.join(listingsDir, entry.name, 'manifest.json'), 'utf8')) as { productId?: unknown; channel?: unknown; productRevision?: unknown };
          const id = entry.name.slice('product-'.length);
          const expectedChannel = type === 'amazon' ? 'amazon' : 'etsy';
          if (manifest.productId === id && manifest.channel === expectedChannel && typeof manifest.productRevision === 'number') folders.push(entry.name);
        } catch { /* Ignore incomplete exports. */ }
    }

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error scanning listings directory:', error);
    return NextResponse.json({ error: 'Failed to scan directory' }, { status: 500 });
  }
}

async function exists(file: string) { try { await fs.access(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }
