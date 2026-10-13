import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { listListingAssets, saveListingAssets } from '@/lib/workspaceAssets';

export const dynamic = 'force-dynamic';
const extensionOrigin = (request: Request) => /^chrome-extension:\/\/[a-z]{32}$/.test(request.headers.get('origin') || '') ? request.headers.get('origin')! : null;
const cors = (request: Request): Record<string, string> => extensionOrigin(request) ? { 'Access-Control-Allow-Origin': extensionOrigin(request)!, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
const logFailure = async (error: unknown) => {
  try {
    await fs.writeFile(path.join(process.cwd(), 'latest_error.json'), JSON.stringify({ route: '/api/workspace/assets', timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }, null, 2));
  } catch (logError) { console.error('Could not write latest_error.json:', logError); }
};

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: extensionOrigin(request) ? 204 : 403, headers: cors(request) });
}

export async function GET() {
  try { return NextResponse.json({ folders: await listListingAssets() }); }
  catch (error) { await logFailure(error); return NextResponse.json({ error: 'Could not load assets.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!extensionOrigin(request)) return NextResponse.json({ error: 'Import must come from the Flat Earth extension.' }, { status: 403 });
  try {
    const form = await request.formData();
    const id = String(form.get('listingId') || '');
    const sourceUrl = String(form.get('sourceUrl') || '');
    const title = String(form.get('title') || '');
    const entries = form.getAll('image');
    const positions = form.getAll('position');
    const sourceUrls = form.getAll('imageSourceUrl');
    if (entries.length !== positions.length || entries.length !== sourceUrls.length) throw new Error('Incomplete image upload.');
    const images = entries.map((entry, index) => {
      if (!(entry instanceof File)) throw new Error('Invalid image upload.');
      return { file: entry, position: Number(positions[index]), sourceUrl: String(sourceUrls[index]) };
    });
    return NextResponse.json({ folder: await saveListingAssets({ id, sourceUrl, title, images }) }, { headers: cors(request) });
  } catch (error) {
    await logFailure(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not import images.' }, { status: 400, headers: cors(request) });
  }
}
