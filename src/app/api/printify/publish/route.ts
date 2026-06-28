import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { 
  uploadImageToPrintify, 
  createPrintifyProduct, 
  getPrintifyShops, 
  getPrintifyVariants 
} from "@/lib/printify";
import { resolvePublicAssetPath } from "@/lib/serverPaths";
import type { Preset } from "@/components/PresetManagerModal";
import type { RowData } from "@/components/SpreadsheetGrid";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preset, rowData }: { preset: Preset, rowData: RowData } = body;

    if (!preset || !rowData) {
      return NextResponse.json({ success: false, error: "Missing preset or rowData" }, { status: 400 });
    }

    // 1. Extract the design image
    const designRaw = rowData.digital_file || rowData.images || "";
    const designPaths = designRaw.split(",").map(i => i.trim()).filter(i => i);
    if (designPaths.length === 0) {
      return NextResponse.json({ success: false, error: "No design image provided. Please add it to the Design File or Images column." }, { status: 400 });
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

    // 3. Get Shop ID
    const shops = await getPrintifyShops();
    const shop = shops.find(s => s.sales_channel === 'etsy') || shops[0];
    if (!shop) {
      return NextResponse.json({ success: false, error: "No Printify shops found." }, { status: 400 });
    }

    // 4. Match Variants
    console.log(`[Printify] Fetching variants for Blueprint ${preset.pod_blueprint_id} and Provider ${preset.pod_print_provider_id}`);
    const availableVariants = await getPrintifyVariants(preset.pod_blueprint_id!, preset.pod_print_provider_id!);
    
    // We need to parse rowData.variations if it exists, or fall back to primary_color / secondary_color
    const requestedColors = new Set<string>();
    const requestedSizes = new Set<string>();

    if (rowData.variations?.properties) {
      rowData.variations.properties.forEach(prop => {
        const title = prop.name.toLowerCase();
        if (title.includes("color")) {
           prop.options.forEach(v => requestedColors.add(v.toLowerCase().trim()));
        } else if (title.includes("size")) {
           prop.options.forEach(v => requestedSizes.add(v.toLowerCase().trim()));
        }
      });
    }

    if (rowData.primary_color) requestedColors.add(rowData.primary_color.toLowerCase().trim());
    if (rowData.secondary_color) requestedColors.add(rowData.secondary_color.toLowerCase().trim());
    
    // If no explicit sizes are requested, we might want to default to standard sizes or just take what they have.
    // For safety, if they didn't specify sizes, let's grab all available sizes for the requested colors.
    
    const matchedVariantIds: number[] = [];
    const skuMap: Record<string, string> = {}; // To pass back to client for Etsy Push injection

    for (const v of availableVariants) {
      const vColor = v.options.color?.toLowerCase() || "";
      const vSize = v.options.size?.toLowerCase() || "";
      
      const matchesColor = requestedColors.size === 0 || requestedColors.has(vColor);
      const matchesSize = requestedSizes.size === 0 || requestedSizes.has(vSize);
      
      if (matchesColor && matchesSize) {
         matchedVariantIds.push(v.id);
      }
    }

    if (matchedVariantIds.length === 0) {
      // If we couldn't match anything perfectly, just fallback to the first variant so it doesn't fail.
      if (availableVariants.length > 0) {
         console.warn("[Printify] No exact variant matches found. Falling back to the first available variant.");
         matchedVariantIds.push(availableVariants[0].id);
      } else {
         return NextResponse.json({ success: false, error: "No variants available for this Print Provider." }, { status: 400 });
      }
    }

    // 5. Create Product
    const title = rowData.title || `Custom ${preset.name}`;
    console.log(`[Printify] Creating product with ${matchedVariantIds.length} variants...`);
    
    const product = await createPrintifyProduct(
       shop.id,
       title,
       preset.pod_blueprint_id!,
       preset.pod_print_provider_id!,
       matchedVariantIds,
       printifyImageId,
       (preset.pod_position as "top" | "center" | "bottom") || "top"
    );

    console.log(`[Printify] Product created! ID: ${product.id}`);

    return NextResponse.json({ 
      success: true, 
      product_id: product.id,
      printify_product: product
    });

  } catch (error: any) {
    console.error("[Printify API Route Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
