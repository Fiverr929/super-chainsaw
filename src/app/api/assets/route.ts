import { NextResponse } from 'next/server';
import fs from '../../../lib/workspaceFs.ts';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderName = searchParams.get('folder');
  const type = searchParams.get('type') || 'digital';

  if (!folderName || folderName === '.' || folderName === '..' || /[\\/\u0000]/.test(folderName) || folderName.includes('..')) {
    return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
  }

  let baseDir = 'listings';
  if (type === 'physical') {
    baseDir = 'listings-physical';
  } else if (type === 'amazon') {
    baseDir = 'listings-amazon';
  }
  
  const listingsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', baseDir, folderName);

  if (!await exists(listingsDir)) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  try {
    const files = await fs.readdir(listingsDir);
    let productId: string | undefined;
    let productRevision: number | undefined;
    let manifestMedia: string[] | undefined;
    let manifestDigital: string[] | undefined;
    const manifestPath = path.join(listingsDir, 'manifest.json');
    if (await exists(manifestPath)) {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { productId?: unknown; productRevision?: unknown; media?: unknown; digitalFiles?: unknown };
      if (typeof manifest.productId === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(manifest.productId)) productId = manifest.productId;
      if (typeof manifest.productRevision === 'number' && Number.isSafeInteger(manifest.productRevision) && manifest.productRevision > 0) productRevision = manifest.productRevision;
      const safeNames = (value: unknown): value is string[] => Array.isArray(value) && value.every(name => typeof name === 'string' && /^[a-zA-Z0-9._-]+$/.test(name) && !name.includes('..'));
      if (safeNames(manifest.media)) manifestMedia = manifest.media;
      if (safeNames(manifest.digitalFiles)) manifestDigital = manifest.digitalFiles;
    }

    // Arrays to hold the detected files
    const images: string[] = [];
    let video = '';
    let digitalFile = '';

    for (const file of manifestMedia || files) {
      if (!await exists(path.join(listingsDir, file))) continue;
      const ext = path.extname(file).toLowerCase();
      // Serve relative paths so the browser can access them via the public directory
      const relativeUrl = `/${baseDir}/${folderName}/${file}`;

      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        images.push(relativeUrl);
      } else if (['.mp4', '.mov', '.avi', '.webm'].includes(ext)) {
        video = relativeUrl; // Assuming 1 promo video per folder
      }
    }

    // Check for a 'digital' subfolder for digital delivery files
    const digitalDirPath = path.join(listingsDir, 'digital');
    if (await exists(digitalDirPath) && (await fs.stat(digitalDirPath)).isDirectory()) {
      const dFiles = manifestDigital || await fs.readdir(digitalDirPath);
      const available = [];
      for (const file of dFiles) if (await exists(path.join(digitalDirPath, file))) available.push(`/${baseDir}/${folderName}/digital/${file}`);
      digitalFile = available.join(',');
    }

    // Sort images numerically/alphabetically (e.g., 1_main.png before 2_back.png)
    images.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return NextResponse.json({
      images: images.join(','),
      video,
      digital_file: digitalFile,
      ...(productId ? { workspace_product_id: productId } : {}),
      ...(productRevision ? { workspace_product_revision: productRevision } : {})
    });

  } catch (error) {
    console.error('Error scanning folder:', error);
    return NextResponse.json({ error: 'Failed to scan folder' }, { status: 500 });
  }
}

async function exists(file: string) { try { await fs.access(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }
