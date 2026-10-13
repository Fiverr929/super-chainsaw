import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { 
  uploadImageToPrintify, 
  createPrintifyProduct, 
  getPrintifyShops, 
  getPrintifyVariants,
  getPrintifyProduct,
  printifyExternalListingId,
  publishPrintifyProduct
} from "@/lib/printify";
import { resolvePublicAssetPath } from "@/lib/serverPaths";
import { mapPrintifyVariants } from '@/lib/printifyVariantMapping';
import type { Preset } from "@/components/PresetManagerModal";
import type { RowData } from "@/components/SpreadsheetGrid";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preset, rowData, shopId }: { preset: Preset, rowData: RowData, shopId?: number } = body;

    if (!preset || !rowData) {
      return NextResponse.json({ success: false, error: "Missing preset or rowData" }, { status: 400 });
    }
    if (rowData.listing_id) {
      return NextResponse.json({ success: false, error: 'This row already has an Etsy listing. Use the Etsy update actions or link it in Printify; publishing again would create a duplicate.' }, { status: 400 });
    }
    if (!Number.isInteger(shopId) || !shopId || shopId <= 0) {
      return NextResponse.json({ success: false, error: 'Select a Printify shop in Settings before publishing.' }, { status: 400 });
    }

    // Validate the selected shop before uploading artwork so a bad selection
    // cannot create an orphaned Printify upload or product.
    const shops = await getPrintifyShops();
    const shop = shops.find(candidate => candidate.id === shopId);
    if (!shop) {
      return NextResponse.json({ success: false, error: 'Selected Printify shop is no longer available. Choose a shop in Settings.' }, { status: 400 });
    }
    if (shop.sales_channel.toLowerCase() !== 'etsy') {
      return NextResponse.json({ success: false, error: 'Select an Etsy-connected Printify shop in Settings.' }, { status: 400 });
    }
    if (rowData.printify_product_id) {
      const existing = await getPrintifyProduct(shop.id, rowData.printify_product_id);
      const listingId = printifyExternalListingId(existing);
      return NextResponse.json({ success: true, product_id: existing.id, listing_id: listingId, pending: !listingId });
    }

    // 1. Extract the design image
    const designRaw = rowData.digital_file || "";
    const designPaths = designRaw.split(",").map(i => i.trim()).filter(i => i);
    if (designPaths.length === 0) {
      return NextResponse.json({ success: false, error: "Add the print-ready artwork to Design File. Listing mockups cannot be used as print artwork." }, { status: 400 });
    }
    
    // Take the first file as the design
    const relativeDesignPath = designPaths[0]; 
    const designFilePath = resolvePublicAssetPath(relativeDesignPath);

    if (!designFilePath || !fs.existsSync(designFilePath)) {
      return NextResponse.json({ success: false, error: `Design file not found on server: ${relativeDesignPath}` }, { status: 400 });
    }

    // 2. Upload image to Printify
    const imageBuffer = fs.readFileSync(designFilePath);
    const base64Image = imageBuffer.toString('base64');
    const fileName = path.basename(designFilePath);
    
    console.log(`[Printify] Uploading ${fileName}...`);
    const printifyImageId = await uploadImageToPrintify(base64Image, fileName);
    console.log(`[Printify] Uploaded image ID: ${printifyImageId}`);
    let backImageId: string | undefined;
    if (typeof rowData.workspace_back_artwork === 'string' && rowData.workspace_back_artwork) {
      const backPath = resolvePublicAssetPath(rowData.workspace_back_artwork);
      if (!backPath || !fs.existsSync(backPath)) return NextResponse.json({ success: false, error: 'Back print artwork is missing. Reopen the listing draft and save it again.' }, { status: 400 });
      backImageId = await uploadImageToPrintify(fs.readFileSync(backPath).toString('base64'), path.basename(backPath));
    }

    // 3. Match Variants
    const blueprintId = preset.pod_blueprint_id || 706;
    // Printify Choice is the default provider for Comfort Colors 1717. Provider
    // 16 was the old SwiftPOD identifier and is retained for legacy presets.
    const providerId = preset.pod_print_provider_id === 16 ? 39 : (preset.pod_print_provider_id || 99);

    console.log(`[Printify] Fetching variants for Blueprint ${blueprintId} and Provider ${providerId}`);
    const availableVariants = await getPrintifyVariants(blueprintId, providerId);
    
    let variantMapping;
    try { variantMapping = mapPrintifyVariants(availableVariants, rowData.variations?.combinations || [], rowData.primary_color); }
    catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Invalid Printify variants.' }, { status: 400 }); }
    const matchedVariantIds = [...new Set(variantMapping.map(mapping => mapping.variantId))];
    const priceByVariant: Record<number, number> = {};
    for (const mapping of variantMapping) {
      const combination = rowData.variations?.combinations.find(item => item.id === mapping.combinationId);
      const price = Number(combination?.price || rowData.price);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ success: false, error: `Set a valid price for each enabled Printify variation.` }, { status: 400 });
      }
      priceByVariant[mapping.variantId] = Math.round(price * 100);
    }

    // 4. Create Product
    const title = (rowData.title || `Custom ${preset.name}`).slice(0, 140);
    console.log(`[Printify] Creating product with ${matchedVariantIds.length} variants...`);
    
    const product = await createPrintifyProduct(
       shop.id,
       title,
       blueprintId,
       providerId,
       matchedVariantIds,
       printifyImageId,
       (preset.pod_position as "top" | "center" | "bottom") || "top",
       backImageId,
       {
         description: rowData.description,
         tags: rowData.tags?.split(',').map(tag => tag.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().slice(0, 20)).filter(Boolean).slice(0, 13),
         prices: priceByVariant
       }
    );

    console.log(`[Printify] Product created! ID: ${product.id}`);
    try {
      await publishPrintifyProduct(shop.id, product.id);
    } catch (error) {
      return NextResponse.json({
        success: false,
        product_id: product.id,
        error: `${error instanceof Error ? error.message : String(error)}. Product ${product.id} was created in Printify; resolve this before retrying to avoid a duplicate.`
      }, { status: 502 });
    }

    let listingId: string | undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await getPrintifyProduct(shop.id, product.id);
      listingId = printifyExternalListingId(current);
      if (listingId) break;
      if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 2500));
    }

    return NextResponse.json({ 
      success: true, 
      product_id: product.id,
      listing_id: listingId,
      pending: !listingId,
      printify_product: product,
      variant_mapping: variantMapping
    });

  } catch (error: unknown) {
    console.error("[Printify API Route Error]:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
