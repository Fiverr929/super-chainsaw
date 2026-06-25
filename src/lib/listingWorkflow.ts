export type EtsySheetType = 'digital' | 'physical';

export function getEtsyGridStorageKey(sheetType: EtsySheetType): string {
  return sheetType === 'digital'
    ? 'workstation_v2_grid_data_etsy_digital'
    : 'workstation_v2_grid_data_etsy_physical';
}

export type AmazonPublishRow = {
  title?: string; description?: string; sku?: string; sku_template?: string;
  price?: string; quantity?: string; maximum_retail_price?: string;
  minimum_seller_allowed_price?: string; maximum_seller_allowed_price?: string;
  product_id_exemption?: string; hsn_code?: string; brand?: string; outer_material?: string; bullet_points?: string;
  fit_type?: string; style_name?: string; item_type_name?: string; sleeve_type?: string; sleeve_length?: string;
  target_gender?: string; age_range_description?: string; department_name?: string; care_instructions?: string;
  number_of_items?: string; item_weight?: string; manufacturer_address?: string; packer_address?: string;
  item_dimension_length?: string; item_dimension_width?: string; item_dimension_height?: string; variation_theme?: string; size_system?: string;
  variations?: {
    properties?: Array<{ name?: string }>;
    combinations?: Array<{ values?: Record<string, string>; price?: string; quantity?: string; isEnabled?: boolean }>;
  };
};

export function getAmazonPublishValidationError(row: AmazonPublishRow, rowNumber: number): string | null {
  if (!row.title || !row.description) {
    return `Row ${rowNumber} is missing a Title or Description required for publishing.`;
  }
  if (!row.sku && !row.sku_template) {
    return `Row ${rowNumber} needs either a Parent SKU or SKU Template for publishing on Amazon.`;
  }
  const requiredText: Array<[string | undefined, string]> = [
    [row.brand, 'Brand'], [row.outer_material, 'Fabric Type'], [row.bullet_points, 'Bullet Points'], [row.hsn_code, 'HSN Code'],
    [row.fit_type, 'Fit Type'], [row.style_name, 'Style Name'], [row.item_type_name, 'Item Type Name'],
    [row.sleeve_type, 'Sleeve Type'], [row.sleeve_length, 'Sleeve Length'], [row.target_gender, 'Target Gender'],
    [row.age_range_description, 'Age Range'], [row.department_name, 'Department'], [row.care_instructions, 'Care Instructions'],
    [row.number_of_items, 'Number of Items'], [row.item_weight, 'Item Weight'], [row.manufacturer_address, 'Manufacturer Contact'],
    [row.packer_address, 'Packer Contact'], [row.item_dimension_length, 'Item Length'], [row.item_dimension_width, 'Item Width'],
    [row.item_dimension_height, 'Item Height']
  ];
  const missingRequired = requiredText.find(([value]) => !value || value === 'None');
  if (missingRequired) return `Row ${rowNumber} is missing required Amazon field: ${missingRequired[1]}.`;
  if (!/^.{4,8}$/.test(row.hsn_code || '')) return `Row ${rowNumber} needs a 4 to 8 character HSN code.`;
  for (const [value, label] of [[row.item_dimension_length, 'Item Length'], [row.item_dimension_width, 'Item Width'], [row.item_dimension_height, 'Item Height']] as const) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) return `Row ${rowNumber} has an invalid ${label}.`;
  }
  const parsePrice = (value?: string) => value === undefined || value === '' ? null : Number(value);
  const price = parsePrice(row.price);
  const quantity = row.quantity === undefined || row.quantity === '' ? null : Number(row.quantity);
  if (price !== null && (!Number.isFinite(price) || price <= 0)) return `Row ${rowNumber} has an invalid Amazon price.`;
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) return `Row ${rowNumber} has an invalid Amazon quantity.`;
  const mrp = parsePrice(row.maximum_retail_price);
  if (price !== null && mrp !== null && (!Number.isFinite(mrp) || mrp < price)) return `Row ${rowNumber} has an MRP below its selling price.`;
  const minimum = parsePrice(row.minimum_seller_allowed_price);
  if (price !== null && minimum !== null && (!Number.isFinite(minimum) || minimum > price)) return `Row ${rowNumber} has a minimum seller price above its selling price.`;
  const maximum = parsePrice(row.maximum_seller_allowed_price);
  if (price !== null && maximum !== null && (!Number.isFinite(maximum) || maximum < price)) return `Row ${rowNumber} has a maximum seller price below its selling price.`;

  const enabled = row.variations?.combinations?.filter(combination => combination.isEnabled) || [];
  if ((row.variations?.properties?.length || 0) > 0) {
    if (enabled.length === 0) return `Row ${rowNumber} needs at least one enabled Amazon variation.`;
    const seen = new Set<string>();
    for (const combination of enabled) {
      const entries = Object.entries(combination.values || {});
      const color = entries.find(([key]) => key.toLowerCase() === 'color')?.[1]?.trim();
      const size = entries.find(([key]) => key.toLowerCase() === 'size')?.[1]?.trim();
      if (!color || !size) return `Row ${rowNumber} has an enabled variation without both Color and Size.`;
      const key = color.toLowerCase() + '|' + size.toLowerCase();
      if (seen.has(key)) return `Row ${rowNumber} has a duplicate ${color} / ${size} variation.`;
      seen.add(key);
      const childPrice = Number(combination.price || row.price);
      const childQuantity = Number(combination.quantity || row.quantity);
      if (!Number.isFinite(childPrice) || childPrice <= 0) return `Row ${rowNumber} has a variation with an invalid price.`;
      if (!Number.isInteger(childQuantity) || childQuantity < 0) return `Row ${rowNumber} has a variation with an invalid quantity.`;
    }
  } else if (price === null || quantity === null) {
    return `Row ${rowNumber} needs a price and quantity for a standalone Amazon listing.`;
  }
  return null;
}

export type AmazonPushResponse = {
  success?: boolean;
  partial?: boolean;
  asin?: string | null;
  details?: unknown;
  error?: unknown;
  pending?: boolean;
};

export type AmazonPushResult = {
  status: 'Published' | 'Submitted' | 'Partial Error' | 'Error';
  asin: string;
  message: string;
  isError: boolean;
};

function describeUnknown(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

export function getAmazonPushResult(response: AmazonPushResponse, currentAsin = ''): AmazonPushResult {
  const asin = response.asin || currentAsin;
  if (response.success && !response.partial) {
    return {
      status: response.pending ? 'Submitted' : 'Published',
      asin,
      message: response.pending ? 'Amazon accepted the submission and is still processing it.' : 'Successfully pushed listing to Amazon!',
      isError: false,
    };
  }
  if (response.success && response.partial) {
    return {
      status: 'Partial Error',
      asin,
      message: describeUnknown(response.details, 'Amazon created the parent listing, but one or more variants failed.'),
      isError: true,
    };
  }
  return {
    status: 'Error',
    asin: currentAsin,
    message: describeUnknown(response.details ?? response.error, 'Unknown Error'),
    isError: true,
  };
}

const GENERATED_METADATA_KEYS = [
  'title',
  'description',
  'tags',
  'alt_texts',
  'primary_color',
  'secondary_color',
  'materials',
  'sleeve_length',
  'neckline',
  'clothing_style',
  'capacity',
  'dishwasher_safe',
  'microwave_safe',
  'orientation',
  'framing',
  'aspect_ratio',
  'occasion',
  'celebration',
  'subject',
  'graphic',
] as const;

export function buildGeneratedMetadataResponse(content: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(GENERATED_METADATA_KEYS.map(key => [key, content[key]]));
}

export type ImportableRow = {
  folder?: string;
  images?: string;
  title?: string;
  sku?: string;
  asin?: string;
  [key: string]: unknown;
};

export type FolderScanTarget = { rowIndex: number; folderName: string };

export function planFolderImport<T extends ImportableRow>(existingRows: T[], rowsToImport: T[]): {
  rows: T[];
  scanTargets: FolderScanTarget[];
} {
  const rows = [...existingRows];
  const scanTargets: FolderScanTarget[] = [];
  let insertedCount = 0;

  for (let index = 0; index < rows.length && insertedCount < rowsToImport.length; index++) {
    const row = rows[index];
    const isEmpty = !row.folder && !row.images && !row.title && !row.sku && !row.asin;
    if (isEmpty) {
      rows[index] = rowsToImport[insertedCount];
      scanTargets.push({ rowIndex: index, folderName: rowsToImport[insertedCount].folder || '' });
      insertedCount++;
    }
  }

  while (insertedCount < rowsToImport.length) {
    const rowIndex = rows.length;
    rows.push(rowsToImport[insertedCount]);
    scanTargets.push({ rowIndex, folderName: rowsToImport[insertedCount].folder || '' });
    insertedCount++;
  }

  return { rows, scanTargets };
}