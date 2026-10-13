export interface PrintifyShop {
  id: number;
  title: string;
  sales_channel: string;
}

export interface PrintifyBlueprint {
  id: number;
  title: string;
  brand: string;
  model: string;
  images: string[];
}

export interface PrintifyProvider {
  id: number;
  title: string;
}

export interface PrintifyVariant {
  id: number;
  title: string;
  options: {
    color: string;
    size: string;
  };
}

export interface PrintifyProduct {
  id: string;
  title: string;
  external?: { id: string; handle?: string } | { id: string; handle?: string }[] | null;
  variants: {
    id: number;
    sku: string;
    cost: number;
    price: number;
    title: string;
    is_enabled: boolean;
  }[];
}

const getHeaders = () => {
  const apiKey = process.env.printify_api;
  if (!apiKey) {
    throw new Error("Missing printify_api in environment variables");
  }
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
};

export async function getPrintifyShops(): Promise<PrintifyShop[]> {
  const res = await fetch("https://api.printify.com/v1/shops.json", {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch shops: ${res.statusText}`);
  return res.json();
}

export async function getPrintifyBlueprints(): Promise<PrintifyBlueprint[]> {
  const res = await fetch("https://api.printify.com/v1/catalog/blueprints.json", {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch blueprints: ${res.statusText}`);
  return res.json();
}

export async function getPrintifyProviders(blueprintId: number): Promise<PrintifyProvider[]> {
  const res = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers.json`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch print providers: ${res.statusText}`);
  return res.json();
}

export async function getPrintifyVariants(blueprintId: number, providerId: number): Promise<PrintifyVariant[]> {
  const res = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch variants: ${res.statusText}`);
  const data = await res.json();
  return data.variants || [];
}

export async function uploadImageToPrintify(base64Image: string, fileName: string = "design.png"): Promise<string> {
  // Printify expects raw base64, without data URI prefix if provided
  let contents = base64Image;
  if (contents.startsWith('data:image')) {
    contents = contents.split(',')[1];
  }

  const res = await fetch("https://api.printify.com/v1/uploads/images.json", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      file_name: fileName,
      contents: contents
    })
  });
  
  if (!res.ok) {
     const err = await res.text();
     throw new Error(`Failed to upload image: ${err}`);
  }
  
  const data = await res.json();
  return data.id;
}

export async function createPrintifyProduct(
  shopId: number,
  title: string,
  blueprintId: number,
  providerId: number,
  variantIds: number[],
  imageId: string,
  position: 'top' | 'center' | 'bottom',
  backImageId?: string,
  details?: { description?: string; tags?: string[]; prices?: Record<number, number> }
): Promise<PrintifyProduct> {

  let yPos = 0.5; // Center
  if (position === 'top') yPos = 0.25;
  if (position === 'bottom') yPos = 0.75;

  const productData = {
    title: title,
    description: details?.description || title,
    tags: details?.tags || [],
    blueprint_id: blueprintId,
    print_provider_id: providerId,
    variants: variantIds.map(id => ({ id, price: details?.prices?.[id] ?? 2000, is_enabled: true })),
    print_areas: [
      {
        variant_ids: variantIds,
        placeholders: [
          {
            position: "front",
            images: [
              {
                id: imageId,
                x: 0.5,
                y: yPos,
                scale: 1, // Standard scale
                angle: 0
              }
            ]
          },
          ...(backImageId ? [{ position: 'back', images: [{ id: backImageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] : []),
        ]
      }
    ]
  };

  const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products.json`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(productData)
  });

  if (!res.ok) {
     const err = await res.text();
     throw new Error(`Failed to create product: ${err}`);
  }

  return res.json();
}

export async function publishPrintifyProduct(shopId: number, productId: string): Promise<void> {
  const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products/${productId}/publish.json`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: true })
  });
  if (!res.ok) throw new Error(`Printify publish failed: ${await res.text()}`);
}

export async function getPrintifyProduct(shopId: number, productId: string): Promise<PrintifyProduct> {
  const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products/${productId}.json`, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Printify product lookup failed: ${await res.text()}`);
  return res.json();
}

export function printifyExternalListingId(product: PrintifyProduct): string | undefined {
  const external = Array.isArray(product.external) ? product.external[0] : product.external;
  return external?.id ? String(external.id) : undefined;
}
