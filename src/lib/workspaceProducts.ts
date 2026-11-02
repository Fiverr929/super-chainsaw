export type Placement = {
  x: number; y: number; width: number; height: number;
  opacity: number; margin: number; realism: number; softness: number;
  locked?: boolean;
  artwork?: { x: number; y: number; scale: number; rotation?: number; fit?: 'contain' | 'cover' };
};

export type MockupFrame = {
  id: string; name: string; role: 'Front' | 'Back' | 'Side' | 'Model' | 'Detail';
  imageDataUrl?: string; applyDesign: boolean; placement: Placement;
};

export type MockupPreset = {
  id: string; name: string; productType: string; color: string; frames: MockupFrame[];
  brand?: string; model?: string;
};

export type GeneratedMockup = { id: string; name: string; dataUrl: string };
export type ArtworkRole = 'front' | 'back';
export type GallerySlot = {
  id: string;
  kind: 'mockup' | 'image' | 'video';
  label: string;
  frameId?: string;
  assetUrl?: string;
};
export type GalleryItem = GallerySlot & { url: string };

export type WorkspaceProduct = {
  id: string;
  revision: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  designDataUrl: string | null;
  artworks?: Partial<Record<ArtworkRole, string>>;
  sourceImage?: string;
  origin?: {
    designName: string;
    designKind: 'design-stage' | 'upload';
    mockupSource: 'app' | 'user';
    mockupPresetId: string;
    sourceAssetUrl?: string;
  };
  preset: MockupPreset;
  generated: GeneratedMockup[];
  gallerySlots?: GallerySlot[];
  renderState: 'draft' | 'queued' | 'rendering' | 'ready' | 'error';
  error?: string;
};

export type ProductSnapshot = Pick<WorkspaceProduct, 'designDataUrl' | 'preset' | 'generated'> & Pick<WorkspaceProduct, 'artworks'>;
export type ProductChannel = 'etsy' | 'amazon';

export function createWorkspaceProduct(input: { name:string; designDataUrl:string|null; preset:MockupPreset; backArtwork?:string|null; sourceImage?:string; designName?:string; designKind?:'design-stage'|'upload'; sourceAssetUrl?:string; id?:string }): WorkspaceProduct {
  const id=input.id||crypto.randomUUID();
  const gallerySlots:GallerySlot[]=input.preset.frames.filter(frame=>frame.imageDataUrl).map(frame=>({id:`mockup-${frame.id}`,kind:'mockup',label:`${frame.role} shirt`,frameId:frame.id}));
  return {id,revision:0,name:input.name,createdAt:'',updatedAt:'',designDataUrl:input.designDataUrl,artworks:{...(input.designDataUrl?{front:input.designDataUrl}:{}),...(input.backArtwork?{back:input.backArtwork}:{})},preset:structuredClone(input.preset),origin:{designName:input.designName||input.name,designKind:input.designKind||'upload',mockupSource:input.preset.id.startsWith('cc1717-')||input.preset.id.startsWith('vintage-front-2k-')?'app':'user',mockupPresetId:input.preset.id,...(input.sourceAssetUrl?{sourceAssetUrl:input.sourceAssetUrl}:{})},generated:[],gallerySlots,renderState:'draft',...(input.sourceImage?{sourceImage:input.sourceImage}:{})};
}

export function triggerListingCopy(
  channel: ProductChannel,
  row: number,
  generators: Record<ProductChannel, (row: number) => Promise<void>>,
): Promise<void> {
  return generators[channel](row);
}

export type ListingPresetValues = Record<string, unknown> & { id: string; name: string };

const LISTING_PRESET_FIELDS = [
  'category', 'section', 'primary_color', 'secondary_color', 'price', 'quantity', 'context',
  'occasion', 'celebration', 'subject', 'who_made', 'when_made', 'is_supply',
  'renewal_options', 'ai_title_rules', 'ai_desc_rules', 'ai_tag_rules', 'shipping_profile',
  'readiness_state_id', 'production_partner', 'materials', 'sleeve_length', 'neckline',
  'clothing_style', 'capacity', 'dishwasher_safe', 'microwave_safe', 'orientation',
  'framing', 'aspect_ratio', 'graphic', 'enable_pod', 'pod_blueprint_id',
  'pod_print_provider_id', 'pod_position', 'variations',
] as const;

export function listingPresetValues(preset: ListingPresetValues): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of LISTING_PRESET_FIELDS) {
    if (preset[field] !== undefined) values[field] = structuredClone(preset[field]);
  }
  return values;
}

export function artworkForFrame(product: Pick<WorkspaceProduct, 'designDataUrl' | 'artworks'>, role: MockupFrame['role']): string | null {
  return role === 'Back'
    ? (product.artworks ? product.artworks.back || null : product.designDataUrl)
    : product.artworks?.front || product.designDataUrl;
}

export function galleryItems(product: Pick<WorkspaceProduct, 'gallerySlots' | 'generated'>): GalleryItem[] {
  if (!product.gallerySlots) return product.generated.map(image => ({ id: image.id, kind: 'mockup', label: image.name, frameId: image.id, url: image.dataUrl }));
  return product.gallerySlots.flatMap(slot => {
    const url = slot.kind === 'mockup'
      ? product.generated.find(image => image.id === slot.frameId)?.dataUrl
      : slot.assetUrl;
    return url ? [{ ...slot, url }] : [];
  });
}

export function productInputSignature(snapshot: Pick<ProductSnapshot, 'designDataUrl' | 'preset' | 'artworks'>): string {
  const preset = { ...snapshot.preset, frames: snapshot.preset.frames.map(frame => {
    const placement = { ...frame.placement };
    delete placement.locked; // Editing protection does not change rendered pixels.
    return { ...frame, placement };
  }) };
  return JSON.stringify([snapshot.designDataUrl, snapshot.artworks, preset]);
}

/** Re-importing refreshes assets only; listing edits and remote IDs must survive. */
export function mergeProductIntoListing<T extends Record<string, unknown>>(
  rows: T[], product: WorkspaceProduct, listingPreset?: ListingPresetValues, options: { updateOnly?: boolean } = {},
): Array<T | Record<string, unknown>> {
  const listingImages = galleryItems(product).filter(item => item.kind !== 'video');
  if (!product.designDataUrl || listingImages.length === 0 || product.renderState !== 'ready') {
    throw new Error('Generate and save mockups before preparing a listing.');
  }
  if (listingImages.length > 10) throw new Error('Select no more than 10 listing images.');
  const index = rows.findIndex(row => row.workspace_product_id === product.id);
  if (options.updateOnly && index < 0) throw new Error('The listing draft no longer exists. Create a new draft from Products.');
  const assets = {
    workspace_product_id: product.id,
    workspace_product_revision: product.revision,
    folder: `product-${product.id}`,
    images: listingImages.map(image => image.url).join(','),
    digital_file: product.artworks?.front || product.designDataUrl,
    workspace_back_artwork: product.artworks?.back || '',
  };
  if (index >= 0) {
    return rows.map((row, i) => i === index ? { ...row, ...assets } : row);
  }
  const draft = {
    ...listingPreset && listingPresetValues(listingPreset),
    ...assets, status: 'Draft', title: '',
    context: [listingPreset?.context, `Product: ${product.name}. ${product.preset.productType}, ${product.preset.color}.`].filter(Boolean).join('\n'),
    primary_color: listingPreset?.primary_color || product.preset.color,
    ...(listingPreset ? { listing_preset_id: listingPreset.id, listing_preset_name: listingPreset.name } : {}),
  };
  const emptyIndex = rows.findIndex(row => !['folder', 'title', 'context', 'images', 'digital_file', 'description', 'listing_id', 'asin', 'sku', 'workspace_product_id'].some(key => row[key]));
  if (emptyIndex >= 0) return rows.map((row, i) => i === emptyIndex ? { ...row, ...draft } : row);
  return [...rows, draft];
}

export function productGridKey(channel: ProductChannel): string {
  return channel === 'etsy' ? 'workstation_v2_grid_data_etsy_physical' : 'workstation_v2_grid_data_amazon';
}

/** Revisions also change for names and editor settings; compare the exported gallery itself. */
export function productListingMediaState(product: WorkspaceProduct, images: string[] | null): 'current' | 'changed' | 'unknown' | 'not-ready' {
  if (product.renderState !== 'ready') return 'not-ready';
  if (!images) return 'unknown';
  const current = galleryItems(product).filter(item => item.kind !== 'video').map(item => item.url);
  return current.length === images.length && current.every((url, index) => url === images[index]) ? 'current' : 'changed';
}
