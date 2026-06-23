export type EtsySheetType = 'digital' | 'physical';

export function getEtsyGridStorageKey(sheetType: EtsySheetType): string {
  return sheetType === 'digital'
    ? 'workstation_v2_grid_data_etsy_digital'
    : 'workstation_v2_grid_data_etsy_physical';
}

export type AmazonPublishRow = {
  title?: string;
  description?: string;
  sku?: string;
  sku_template?: string;
};

export function getAmazonPublishValidationError(row: AmazonPublishRow, rowNumber: number): string | null {
  if (!row.title || !row.description) {
    return `Row ${rowNumber} is missing a Title or Description required for publishing.`;
  }
  if (!row.sku && !row.sku_template) {
    return `Row ${rowNumber} needs either a Parent SKU or SKU Template for publishing on Amazon.`;
  }
  return null;
}

export type AmazonPushResponse = {
  success?: boolean;
  partial?: boolean;
  asin?: string | null;
  details?: unknown;
  error?: unknown;
};

export type AmazonPushResult = {
  status: 'Published' | 'Partial Error' | 'Error';
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
      status: 'Published',
      asin,
      message: 'Successfully pushed listing to Amazon!',
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