import { generateListingMetadata } from '@/lib/generateListingMetadata';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return generateListingMetadata(request);
}
