import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderName = searchParams.get('folder');

  if (!folderName || folderName.includes('..')) {
    return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
  }

  // We are scoping the scanner strictly to the public/listings directory for security.
  const listingsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'listings', folderName);

  if (!fs.existsSync(listingsDir)) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  try {
    const files = fs.readdirSync(listingsDir);

    // Arrays to hold the detected files
    const images: string[] = [];
    let video = '';
    let digitalFile = '';

    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      // Only serve relative paths so the browser can access them via the public directory
      const relativeUrl = `/listings/${folderName}/${file}`;

      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        images.push(relativeUrl);
      } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
        video = relativeUrl; // Assuming 1 promo video per folder
      }
    });

    // Check for a 'digital' subfolder for digital delivery files
    const digitalDirPath = path.join(listingsDir, 'digital');
    if (fs.existsSync(digitalDirPath) && fs.statSync(digitalDirPath).isDirectory()) {
      const dFiles = fs.readdirSync(digitalDirPath);
      digitalFile = dFiles.map(f => `/listings/${folderName}/digital/${f}`).join(',');
    }

    // Sort images numerically/alphabetically (e.g., 1_main.png before 2_back.png)
    images.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return NextResponse.json({
      images: images.join(','),
      video,
      digital_file: digitalFile
    });

  } catch (error) {
    console.error('Error scanning folder:', error);
    return NextResponse.json({ error: 'Failed to scan folder' }, { status: 500 });
  }
}
