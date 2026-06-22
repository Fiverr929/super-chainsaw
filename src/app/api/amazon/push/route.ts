import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', "AWS4" + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(kDate).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update("aws4_request").digest();
  return kSigning;
}

function getSignatureKeySigV4(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', "AWS4" + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update("aws4_request").digest();
  return kSigning;
}

function mapSizeToAmazonKey(sizeName: string): string {
  const normalized = sizeName.trim().toUpperCase();
  if (normalized === 'S' || normalized === 'SMALL') return 's';
  if (normalized === 'M' || normalized === 'MEDIUM') return 'm';
  if (normalized === 'L' || normalized === 'LARGE') return 'l';
  if (normalized === 'XL' || normalized === 'X-LARGE' || normalized === 'X_LARGE') return 'x_l';
  if (normalized === '2XL' || normalized === 'XXL' || normalized === 'XX-LARGE' || normalized === 'XX_LARGE') return 'xx_l';
  if (normalized === '3XL' || normalized === 'XXXL' || normalized === '3X-LARGE' || normalized === '3X_LARGE') return '3x_l';
  if (normalized === '4XL' || normalized === 'XXXXL' || normalized === '4X-LARGE' || normalized === '4X_LARGE') return '4x_l';
  return normalized.toLowerCase(); // fallback
}

function buildImageAttributes(images: string[], tunnelUrl: string, marketplaceId: string) {
  if (images.length === 0) return {};

  const imgUrls = images.map(img => {
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }
    if (tunnelUrl) {
      const base = tunnelUrl.endsWith('/') ? tunnelUrl.slice(0, -1) : tunnelUrl;
      const relative = img.startsWith('/') ? img : `/${img}`;
      return `${base}${relative}`;
    }
    return img; // fallback
  });

  const attrs: Record<string, any> = {};
  attrs.main_product_image_locator = [
    {
      media_location: imgUrls[0],
      marketplace_id: marketplaceId
    }
  ];

  for (let i = 1; i < imgUrls.length && i <= 8; i++) {
    attrs[`other_product_image_locator_${i}`] = [
      {
        media_location: imgUrls[i],
        marketplace_id: marketplaceId
      }
    ];
  }

  return attrs;
}

function buildImageAttributesForColor(images: string[], tunnelUrl: string, marketplaceId: string, color?: string) {
  if (images.length === 0) return {};
  
  let filteredImages = images;
  if (color) {
    const lowerColor = color.toLowerCase().trim();
    const colorMatches = images.filter(img => {
      const basename = img.split('/').pop() || "";
      return basename.toLowerCase().includes(lowerColor);
    });
    if (colorMatches.length > 0) {
      filteredImages = colorMatches;
    }
  }
  
  return buildImageAttributes(filteredImages, tunnelUrl, marketplaceId);
}

async function putListingItem(
  accessToken: string,
  sku: string,
  payload: any,
  config: {
    sellerId: string;
    awsAccessKey: string;
    awsSecretKey: string;
    region: string;
    marketplaceId: string;
  }
) {
  const host = `sellingpartnerapi-${config.region}.amazon.com`;
  const path = `/listings/2021-08-01/items/${config.sellerId}/${sku}`;
  const queryParams: Record<string, string> = { marketplaceIds: config.marketplaceId };

  const bodyString = JSON.stringify(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.substring(0, 8);
  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');
  
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const payloadHash = crypto.createHash('sha256').update(bodyString).digest('hex');
  
  const canonicalRequest = ['PUT', path, sortedQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/execute-api/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  const signingKey = getSignatureKeySigV4(config.awsSecretKey, dateStamp, config.region, 'execute-api');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const headers = {
    'x-amz-access-token': accessToken,
    'x-amz-date': amzDate,
    'Authorization': `AWS4-HMAC-SHA256 Credential=${config.awsAccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': 'application/json'
  };

  const url = `https://${host}${path}?${sortedQuery}`;
  try {
    const res = await axios.put(url, payload, { headers });
    return { success: true, sku, data: res.data };
  } catch (err: any) {
    console.error(`SP-API PUT failed for ${sku}:`, err.response ? err.response.data : err.message);
    return {
      success: false,
      sku,
      error: err.response ? err.response.data : err.message
    };
  }
}

function buildAttributes(
  rowData: any,
  marketplaceId: string,
  isChild: boolean = false,
  childSku?: string,
  colorVal?: string,
  sizeVal?: string
) {
  const attrs: Record<string, any> = {};

  // Helpers to resolve preset rules
  const resolveDropdown = (val: string | undefined, defaultVal: string | null): string | null => {
    if (val === 'None') return null;
    if (!val || val === 'Auto') return defaultVal;
    return val;
  };

  const resolveToggleText = (val: string | undefined, isAuto: boolean | undefined, defaultVal: string | null): string | null => {
    if (isAuto || val === 'Auto' || (!val && isAuto === undefined)) return defaultVal;
    return val || null;
  };

  const resolveNumber = (val: string | undefined, defaultVal: number | null): number | null => {
    if (!val || isNaN(Number(val))) return defaultVal;
    return Number(val);
  };

  const normalizeEnum = (val: string): string => {
    return val.toLowerCase().replace(/[\s-]+/g, '_');
  };

  // 1. Brand & Manufacturer
  const brandVal = resolveToggleText(rowData.brand, rowData.brand_auto, 'Yivez');
  if (brandVal) {
    attrs.brand = [ { value: brandVal, marketplace_id: marketplaceId } ];
    attrs.manufacturer = [ { value: brandVal, marketplace_id: marketplaceId } ];
  }

  // 2. Material / Outer Fabric
  const materialVal = resolveToggleText(rowData.outer_material, rowData.outer_material_auto, 'Cotton');
  if (materialVal) {
    attrs.fabric_type = [ { value: materialVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
    attrs.material = [ { value: materialVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  // 3. Search Terms / Keywords
  const keywordsVal = resolveToggleText(rowData.keywords, rowData.keywords_auto, 'graphic tee, crop top, y2k style');
  if (keywordsVal) {
    const kArray = keywordsVal.split(/[,\n|;]/).map(k => k.trim()).filter(Boolean);
    if (kArray.length > 0) {
      attrs.generic_keyword = kArray.map(k => ({ value: k, marketplace_id: marketplaceId, language_tag: 'en_IN' }));
    }
  }

  // 4. HSN Code
  const hsnVal = rowData.hsn_code || '61091000';
  if (hsnVal) {
    attrs.external_product_information = [
      {
        entity: 'HSN Code',
        value: hsnVal,
        marketplace_id: marketplaceId
      }
    ];
  }

  // 5. Neck Style
  const neckStyleVal = resolveDropdown(rowData.neck_style, 'Crew Neck');
  if (neckStyleVal) {
    attrs.neck = [ { neck_style: [ { value: neckStyleVal, language_tag: 'en_IN' } ], marketplace_id: marketplaceId } ];
  }

  // 6. Collar Style
  const collarStyleVal = resolveDropdown(rowData.collar_style, 'Collarless');
  if (collarStyleVal) {
    let mappedCollar = collarStyleVal;
    if (mappedCollar === 'Button-Down') mappedCollar = 'Button Down';
    if (mappedCollar === 'Polo') mappedCollar = 'Polo Collar';
    attrs.collar_style = [ { value: mappedCollar, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  // 7. Sleeve configuration (length, type, cuff)
  const sleeveLengthVal = resolveDropdown(rowData.sleeve_length, 'short_sleeve');
  const sleeveTypeVal = resolveDropdown(rowData.sleeve_type, 'Short Sleeve');
  const sleeveCuffVal = resolveDropdown(rowData.sleeve_cuff, null);
  if (sleeveLengthVal || sleeveTypeVal || sleeveCuffVal) {
    const sleeveObj: any = { marketplace_id: marketplaceId };
    if (sleeveLengthVal) {
      let mappedLength = sleeveLengthVal;
      if (mappedLength === "3/4 Sleeve") mappedLength = "3_4_sleeve";
      else if (mappedLength === "Bracelet Sleeve") mappedLength = "bracelet_sleeve";
      else if (mappedLength === "Half Sleeve") mappedLength = "half_sleeve";
      else if (mappedLength === "Long Sleeve") mappedLength = "long_sleeve";
      else if (mappedLength === "Short Sleeve" || mappedLength === "short_sleeve") mappedLength = "short_sleeve";
      else if (mappedLength === "Sleeveless" || mappedLength === "sleeveless") mappedLength = "sleeveless";
      
      sleeveObj.length_description = [ { value: mappedLength } ];
    }
    if (sleeveTypeVal) sleeveObj.type = [ { value: sleeveTypeVal, language_tag: 'en_IN' } ];
    if (sleeveCuffVal) sleeveObj.cuff_style = [ { value: sleeveCuffVal, language_tag: 'en_IN' } ];
    attrs.sleeve = [ sleeveObj ];
  }

  // 8. Top Style
  const topStyleVal = resolveDropdown(rowData.top_style, null);
  if (topStyleVal) {
    attrs.top_style = [ { value: topStyleVal.toLowerCase(), marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  // 9. Shirt Form Type
  const shirtFormVal = resolveDropdown(rowData.shirt_form_type, null);
  if (shirtFormVal) {
    let norm = normalizeEnum(shirtFormVal);
    if (norm === 'tshirt') norm = 't_shirt';
    if (norm === 'button_down') norm = 'tuxedo_shirt';
    attrs.shirt_form_type = [ { value: norm, marketplace_id: marketplaceId } ];
  }

  // 10. Hemline Form
  const hemlineFormVal = resolveDropdown(rowData.hemline_form, null);
  if (hemlineFormVal) {
    attrs.hemline_form = [ { value: normalizeEnum(hemlineFormVal), marketplace_id: marketplaceId } ];
  }

  // 11. Closure Type
  const closureTypeVal = resolveDropdown(rowData.closure_type, null);
  if (closureTypeVal) {
    attrs.closure = [ { type: [ { value: closureTypeVal, language_tag: 'en_IN' } ], marketplace_id: marketplaceId } ];
  }

  // 12. Item Type Name
  const itemTypeNameVal = resolveToggleText(rowData.item_type_name, rowData.item_type_name_auto, 'T-Shirt');
  if (itemTypeNameVal) {
    attrs.item_type_name = [ { value: itemTypeNameVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  // 13. Fabric Stretch & Weight
  const apparelFabricStretchVal = resolveDropdown(rowData.apparel_fabric_stretch, null);
  if (apparelFabricStretchVal) {
    attrs.apparel_fabric_stretch = [ { value: normalizeEnum(apparelFabricStretchVal), marketplace_id: marketplaceId } ];
  }

  const apparelFabricWeightVal = resolveDropdown(rowData.apparel_fabric_weight_class, null);
  if (apparelFabricWeightVal) {
    attrs.apparel_fabric_weight_class = [ { value: normalizeEnum(apparelFabricWeightVal), marketplace_id: marketplaceId } ];
  }

  const fabricStretchabilityVal = resolveToggleText(rowData.fabric_stretchability, rowData.fabric_stretchability_auto, 'stretchable');
  if (fabricStretchabilityVal) {
    attrs.fabric_stretchability = [ { value: normalizeEnum(fabricStretchabilityVal), marketplace_id: marketplaceId } ];
  }

  // 14. Design Attributes
  const specialFeaturesVal = resolveToggleText(rowData.special_features, rowData.special_features_auto, null);
  if (specialFeaturesVal) {
    attrs.special_features = [ { value: specialFeaturesVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const patternVal = resolveToggleText(rowData.pattern, rowData.pattern_auto, null);
  if (patternVal) {
    attrs.pattern = [ { value: patternVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const themeVal = resolveToggleText(rowData.theme, rowData.theme_auto, null);
  if (themeVal) {
    attrs.theme = [ { value: themeVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const subjectCharacterVal = resolveToggleText(rowData.subject_character, rowData.subject_character_auto, null);
  if (subjectCharacterVal) {
    attrs.subject_character = [ { value: subjectCharacterVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const animalThemeVal = resolveToggleText(rowData.animal_theme, rowData.animal_theme_auto, null);
  if (animalThemeVal) {
    attrs.animal_theme = [ { value: animalThemeVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const pocketDescVal = resolveToggleText(rowData.pocket_description, rowData.pocket_description_auto, null);
  if (pocketDescVal) {
    attrs.pocket_description = [ { value: pocketDescVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const numPocketsVal = resolveToggleText(rowData.number_of_pockets, rowData.number_of_pockets_auto, null);
  if (numPocketsVal && !isNaN(Number(numPocketsVal))) {
    attrs.number_of_pockets = [ { value: Number(numPocketsVal), marketplace_id: marketplaceId } ];
  }

  const fashionDecadeVal = resolveDropdown(rowData.fashion_decade, null);
  if (fashionDecadeVal) {
    attrs.fashion_decade = [ { value: fashionDecadeVal, marketplace_id: marketplaceId } ];
  }

  const seasonsVal = resolveToggleText(rowData.seasons, rowData.seasons_auto, null);
  if (seasonsVal) {
    attrs.seasons = [ { value: seasonsVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const embellishmentVal = resolveToggleText(rowData.embellishment_feature, rowData.embellishment_feature_auto, null);
  if (embellishmentVal) {
    attrs.embellishment_feature = [ { value: embellishmentVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  // 15. Sizing & Sizing Systems
  const targetGenderVal = resolveDropdown(rowData.target_gender, 'unisex');
  if (targetGenderVal) {
    attrs.target_gender = [ { value: targetGenderVal, marketplace_id: marketplaceId } ];
  }

  const ageRangeVal = resolveDropdown(rowData.age_range_description, 'adult');
  if (ageRangeVal) {
    attrs.age_range_description = [ { value: ageRangeVal, marketplace_id: marketplaceId } ];
  }

  const departmentVal = resolveDropdown(rowData.department_name, 'unisex-adult');
  if (departmentVal) {
    attrs.department = [ { value: departmentVal, marketplace_id: marketplaceId } ];
  }

  const garmentSizeCountryVal = resolveDropdown(rowData.garment_size_country, 'IN');
  if (garmentSizeCountryVal) {
    attrs.garment_size_country = [ { value: garmentSizeCountryVal, marketplace_id: marketplaceId } ];
  }

  // 16. Sizing measurements (Shoulder to bottom hem length)
  const shoulderHemVal = resolveToggleText(rowData.shoulder_hem_length, rowData.shoulder_hem_length_auto, null);
  const shoulderHemUnitVal = rowData.shoulder_hem_unit || 'inches';
  if (shoulderHemVal && !isNaN(Number(shoulderHemVal))) {
    attrs.shoulder_to_bottom_hem_length = [ { value: Number(shoulderHemVal), unit: shoulderHemUnitVal, marketplace_id: marketplaceId } ];
  }

  // 17. Sizing unit count
  const unitCountVal = resolveNumber(rowData.unit_count, 1);
  const unitCountTypeVal = rowData.unit_count_type || 'Count';
  if (unitCountVal !== null) {
    attrs.unit_count = [ { value: unitCountVal, type: unitCountTypeVal, marketplace_id: marketplaceId } ];
  }

  // 18. Physical Dimensions
  const numItemsVal = resolveNumber(rowData.number_of_items, 1);
  if (numItemsVal !== null) {
    attrs.number_of_items = [ { value: numItemsVal, marketplace_id: marketplaceId } ];
  }

  const packQtyVal = resolveNumber(rowData.item_package_quantity, 1);
  if (packQtyVal !== null) {
    attrs.item_package_quantity = [ { value: packQtyVal, marketplace_id: marketplaceId } ];
  }

  const itemWeightVal = resolveNumber(rowData.item_weight, 150.0);
  const itemWeightUnitVal = rowData.item_weight_unit || 'grams';
  if (itemWeightVal !== null) {
    attrs.item_weight = [ { value: itemWeightVal, unit: itemWeightUnitVal, marketplace_id: marketplaceId } ];
    attrs.item_package_weight = [ { value: itemWeightVal + 50.0, unit: itemWeightUnitVal, marketplace_id: marketplaceId } ]; // package slightly heavier
  }

  // 19. Compliance & Addresses
  if (rowData.manufacturer_address) {
    attrs.rtip_manufacturer_contact_information = [ { value: rowData.manufacturer_address } ];
  }
  if (rowData.packer_address) {
    attrs.packer_contact_information = [ { value: rowData.packer_address, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const careVal = resolveDropdown(rowData.care_instructions, 'Machine Wash');
  if (careVal) {
    attrs.care_instructions = [ { value: careVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  const partNumberVal = resolveToggleText(rowData.part_number, rowData.part_number_auto, childSku || rowData.sku || null);
  if (partNumberVal) {
    attrs.part_number = [ { value: partNumberVal, marketplace_id: marketplaceId } ];
    if (isChild) {
      attrs.model_number = [ { value: partNumberVal, marketplace_id: marketplaceId } ];
      attrs.manufacturer_part_number = [ { value: partNumberVal, marketplace_id: marketplaceId } ];
    }
  }

  if (rowData.is_customizable) {
    attrs.is_customizable = [ { value: rowData.is_customizable === 'Yes', marketplace_id: marketplaceId } ];
  }
  if (rowData.is_green_purchasing_law_compliant) {
    attrs.is_green_purchasing_law_compliant = [ { value: rowData.is_green_purchasing_law_compliant === 'Yes', marketplace_id: marketplaceId } ];
  }
  if (rowData.product_site_launch_date) {
    attrs.product_site_launch_date = [ { value: rowData.product_site_launch_date, marketplace_id: marketplaceId } ];
  }

  // 20. Sports, League, Team, Lifestyle
  const sportTypeVal = resolveToggleText(rowData.sport_type, rowData.sport_type_auto, null);
  if (sportTypeVal) {
    attrs.sport_type = [ { value: sportTypeVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }
  const leagueNameVal = resolveToggleText(rowData.league_name, rowData.league_name_auto, null);
  if (leagueNameVal) {
    attrs.league_name = [ { value: leagueNameVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }
  const teamNameVal = resolveToggleText(rowData.team_name, rowData.team_name_auto, null);
  if (teamNameVal) {
    attrs.team_name = [ { value: teamNameVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }
  const lifestyleVal = resolveToggleText(rowData.lifestyle, rowData.lifestyle_auto, null);
  if (lifestyleVal) {
    attrs.lifestyle = [ { value: lifestyleVal, marketplace_id: marketplaceId, language_tag: 'en_IN' } ];
  }

  return attrs;
}

export async function POST(request: Request) {
  let requestBody: any = null;
  try {
    requestBody = await request.json();
    const rowData = requestBody;

    const clientID = process.env.SP_API_CLIENT_ID;
    const clientSecret = process.env.SP_API_CLIENT_SECRET;
    const refreshToken = process.env.SP_API_REFRESH_TOKEN;
    const awsAccessKey = process.env.SP_API_AWS_ACCESS_KEY;
    const awsSecretKey = process.env.SP_API_AWS_SECRET_KEY;
    const region = process.env.SP_API_REGION || 'eu';
    const sellerId = process.env.SP_API_SELLER_ID;
    const marketplaceId = 'A21TJRUUN4KGV'; // Amazon India

    if (!clientID || !clientSecret || !refreshToken || !awsAccessKey || !awsSecretKey || !sellerId) {
      return NextResponse.json({ error: 'Missing Amazon SP-API credentials in .env.local' }, { status: 400 });
    }

    let parentSku = rowData.sku;
    if (!parentSku && rowData.sku_template) {
      let baseSku = rowData.sku_template;
      baseSku = baseSku.replace(/{brand(?::(\d+))?}/gi, (match: string, p1: string) => {
        const val = (rowData.brand || 'YVZ').replace(/\s+/g, '');
        return (p1 && !isNaN(parseInt(p1))) ? val.substring(0, parseInt(p1)) : val;
      });
      baseSku = baseSku.replace(/{folder(?::(\d+))?}/gi, (match: string, p1: string) => {
        const val = (rowData.folder || 'ITEM').replace(/\s+/g, '-');
        return (p1 && !isNaN(parseInt(p1))) ? val.substring(0, parseInt(p1)) : val;
      });
      baseSku = baseSku.replace(/{part_number(?::(\d+))?}/gi, (match: string, p1: string) => {
        const val = (rowData.part_number || '').replace(/\s+/g, '');
        return (p1 && !isNaN(parseInt(p1))) ? val.substring(0, parseInt(p1)) : val;
      });
      
      // For parent, remove {color} and {size}
      baseSku = baseSku.replace(/-?{color}-?/gi, '-');
      baseSku = baseSku.replace(/-?{size}-?/gi, '-');
      baseSku = baseSku.replace(/{timestamp}/gi, Date.now().toString());
      
      parentSku = baseSku.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toUpperCase();
      if (!parentSku) parentSku = `YVZ-AMZN-${Date.now()}`;
    } else if (!parentSku) {
      parentSku = `YVZ-AMZN-${Date.now()}`;
    }
    const tunnelUrl = rowData.tunnelUrl || '';

    // Parse image list
    const imageList: string[] = rowData.images
      ? rowData.images.split(',').map((img: string) => img.trim()).filter(Boolean)
      : [];

    // Parse variations structure
    let parsedVariations = rowData.variations;
    if (typeof parsedVariations === 'string' && parsedVariations.trim() !== '') {
      try {
        parsedVariations = JSON.parse(parsedVariations);
      } catch (e) {
        console.error("Failed to parse variations JSON:", e);
      }
    }

    const hasActiveVariations = parsedVariations && 
                                Array.isArray(parsedVariations.properties) && 
                                parsedVariations.properties.length > 0 &&
                                Array.isArray(parsedVariations.combinations);

    const enabledCombs = hasActiveVariations 
      ? parsedVariations.combinations.filter((c: any) => c.isEnabled)
      : [];

    // 1. Authenticate with LWA
    const tokenRes = await axios.post('https://api.amazon.com/auth/o2/token', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientID,
      client_secret: clientSecret
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const accessToken = tokenRes.data.access_token;

    const apiConfig = { sellerId, awsAccessKey, awsSecretKey, region, marketplaceId };

    // 2. Prepare Parent Listing Payload
    const parentImageAttrs = buildImageAttributes(imageList, tunnelUrl, marketplaceId);
    
    // Parse Bullet Points
    const bpStr = rowData.bullet_points || "";
    const bpArray = bpStr.split(/[,\n|;]/).map((s: string) => s.trim()).filter(Boolean);
    const bulletPointsPayload = bpArray.length > 0
      ? bpArray.map((bp: string) => ({ value: bp, marketplace_id: marketplaceId, language_tag: 'en_IN' }))
      : [ { value: rowData.title || "Premium Retro Graphic Baby Tee", marketplace_id: marketplaceId, language_tag: 'en_IN' } ];

    const parentPayload: any = {
      productType: 'SHIRT',
      requirements: 'LISTING',
      attributes: {
        item_name: [ { value: rowData.title, marketplace_id: marketplaceId, language_tag: 'en_IN' } ],
        country_of_origin: [ { value: 'IN', marketplace_id: marketplaceId } ],
        product_description: [ { value: rowData.description || rowData.title, marketplace_id: marketplaceId, language_tag: 'en_IN' } ],
        bullet_point: bulletPointsPayload,
        recommended_browse_nodes: [ { value: '1968545031', marketplace_id: marketplaceId } ],
        fit_type: [ { value: 'regular', marketplace_id: marketplaceId, language_tag: 'en_IN' } ],
        model_name: [ { value: rowData.title, marketplace_id: marketplaceId, language_tag: 'en_IN' } ],
        model_year: [ { value: 2026, marketplace_id: marketplaceId } ],
        item_length_description: [ { value: 'crop', marketplace_id: marketplaceId } ],
        ...buildAttributes(rowData, marketplaceId, false, parentSku),
        ...parentImageAttrs
      }
    };

    if (hasActiveVariations && enabledCombs.length > 0) {
      parentPayload.attributes.parentage_level = [ { value: 'parent', marketplace_id: marketplaceId } ];
      parentPayload.attributes.variation_theme = [ { name: 'SIZE_NAME/COLOR_NAME', marketplace_id: marketplaceId } ];
    }

    console.log(`Pushing parent listing SKU: ${parentSku}...`);
    const parentRes = await putListingItem(accessToken, parentSku, parentPayload, apiConfig);

    if (!parentRes.success) {
      throw new Error(`Failed to create parent listing: ${JSON.stringify(parentRes.error)}`);
    }

    // 3. Push Variation Children
    const childErrors: any[] = [];
    let succeededChildrenCount = 0;

    if (hasActiveVariations && enabledCombs.length > 0) {
      console.log(`Pushing ${enabledCombs.length} child variation listings...`);
      for (const comb of enabledCombs) {
        const values = comb.values || {};
        let colorVal = "";
        let sizeVal = "";

        for (const k of Object.keys(values)) {
          if (k.toLowerCase() === 'color') {
            colorVal = values[k];
          } else if (k.toLowerCase() === 'size') {
            sizeVal = values[k];
          }
        }

        if (!colorVal || !sizeVal) {
          childErrors.push({ combinationId: comb.id, error: "Missing Color or Size value in combination" });
          continue;
        }

        const cleanColor = colorVal.trim().toUpperCase().replace(/\s+/g, '-');
        const cleanSize = sizeVal.trim().toUpperCase().replace(/\s+/g, '-');
        
        let childSku = "";
        if (rowData.sku_template) {
            let baseSku = rowData.sku_template;
            baseSku = baseSku.replace(/{brand(?::(\d+))?}/gi, (match: string, p1: string) => {
              const val = (rowData.brand || 'YVZ').replace(/\s+/g, '');
              return (p1 && !isNaN(parseInt(p1))) ? val.substring(0, parseInt(p1)) : val;
            });
            baseSku = baseSku.replace(/{folder(?::(\d+))?}/gi, (match: string, p1: string) => {
              const val = (rowData.folder || 'ITEM').replace(/\s+/g, '-');
              return (p1 && !isNaN(parseInt(p1))) ? val.substring(0, parseInt(p1)) : val;
            });
            baseSku = baseSku.replace(/{part_number(?::(\d+))?}/gi, (match: string, p1: string) => {
              const val = (rowData.part_number || '').replace(/\s+/g, '');
              return (p1 && !isNaN(parseInt(p1))) ? val.substring(0, parseInt(p1)) : val;
            });
            
            if (!baseSku.toLowerCase().includes('{color}')) baseSku += `-{color}`;
            if (!baseSku.toLowerCase().includes('{size}')) baseSku += `-{size}`;
            
            baseSku = baseSku.replace(/{color}/gi, cleanColor);
            baseSku = baseSku.replace(/{size}/gi, cleanSize);
            baseSku = baseSku.replace(/{timestamp}/gi, Date.now().toString());
            childSku = baseSku.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').toUpperCase();
        } else {
            childSku = `${parentSku}-${cleanColor}-${cleanSize}`.replace(/[^a-zA-Z0-9-]/g, '-').toUpperCase();
        }

        const priceVal = comb.price || rowData.price || "1200";
        const quantityVal = comb.quantity || rowData.quantity || "10";

        // Build child specific images
        const childImageAttrs = buildImageAttributesForColor(imageList, tunnelUrl, marketplaceId, colorVal);

        const childPayload = {
          productType: 'SHIRT',
          requirements: 'LISTING',
          attributes: {
            item_name: [ { value: `${rowData.title} (${colorVal}, ${sizeVal})`, marketplace_id: marketplaceId, language_tag: 'en_IN' } ],
            country_of_origin: [ { value: 'IN', marketplace_id: marketplaceId } ],
            product_description: [ { value: rowData.description || rowData.title, marketplace_id: marketplaceId, language_tag: 'en_IN' } ],
            bullet_point: bulletPointsPayload,
            parentage_level: [ { value: 'child', marketplace_id: marketplaceId } ],
            variation_theme: [ { name: 'SIZE_NAME/COLOR_NAME', marketplace_id: marketplaceId } ],
            child_parent_sku_relationship: [ { child_parent_sku_relationship_name: 'VARIATION', parent_sku: parentSku, marketplace_id: marketplaceId } ],
            color: [ { value: colorVal, standardized_values: [colorVal], language_tag: 'en_IN', marketplace_id: marketplaceId } ],
            shirt_size: [ { size_system: 'as5', size_class: 'alpha', size: mapSizeToAmazonKey(sizeVal), marketplace_id: marketplaceId } ],
            supplier_declared_has_product_identifier_exemption: [ { value: true, marketplace_id: marketplaceId } ],
            purchasable_offer: [
              {
                marketplace_id: marketplaceId,
                currency: 'INR',
                our_price: [
                  {
                    schedule: [
                      {
                        value_with_tax: parseFloat(priceVal)
                      }
                    ]
                  }
                ],
                maximum_retail_price: [
                  {
                    schedule: [
                      {
                        value_with_tax: parseFloat(rowData.maximum_retail_price || Math.round(parseFloat(priceVal) * 1.86).toString())
                      }
                    ]
                  }
                ],
                minimum_seller_allowed_price: rowData.minimum_seller_allowed_price ? [
                  {
                    schedule: [
                      {
                        value_with_tax: parseFloat(rowData.minimum_seller_allowed_price)
                      }
                    ]
                  }
                ] : undefined,
                maximum_seller_allowed_price: rowData.maximum_seller_allowed_price ? [
                  {
                    schedule: [
                      {
                        value_with_tax: parseFloat(rowData.maximum_seller_allowed_price)
                      }
                    ]
                  }
                ] : undefined
              }
            ],
            fulfillment_availability: [
              {
                fulfillment_channel_code: 'DEFAULT',
                quantity: parseInt(quantityVal, 10)
              }
            ],
            recommended_browse_nodes: [ { value: '1968545031', marketplace_id: marketplaceId } ],
            fit_type: [ { value: 'regular', marketplace_id: marketplaceId } ],
            model_name: [ { value: rowData.title, marketplace_id: marketplaceId } ],
            model_year: [ { value: 2026, marketplace_id: marketplaceId } ],
            item_length_description: [ { value: 'crop', marketplace_id: marketplaceId } ],
            item_dimensions: [
              {
                height: { value: 1.0, unit: 'centimeters' },
                length: { value: 20.0, unit: 'centimeters' },
                width: { value: 15.0, unit: 'centimeters' },
                marketplace_id: marketplaceId
              }
            ],
            item_package_dimensions: [
              {
                height: { value: 2.0, unit: 'centimeters' },
                length: { value: 20.0, unit: 'centimeters' },
                width: { value: 15.0, unit: 'centimeters' },
                marketplace_id: marketplaceId
              }
            ],
            ...buildAttributes(rowData, marketplaceId, true, childSku),
            ...childImageAttrs
          }
        };

        const childRes = await putListingItem(accessToken, childSku, childPayload, apiConfig);
        if (childRes.success) {
          succeededChildrenCount++;
        } else {
          childErrors.push({ sku: childSku, error: childRes.error });
        }
      }
    }

    const createdAsin = parentRes.data?.identifiers?.[0]?.asin || null;

    if (childErrors.length > 0) {
      console.warn(`Amazon Push completed with some errors. Succeeded children: ${succeededChildrenCount}/${enabledCombs.length}`);
      
      // Save errors log
      try {
        fs.writeFileSync(path.join(process.cwd(), 'latest_error.json'), JSON.stringify({
          timestamp: new Date().toISOString(),
          requestBody,
          errors: childErrors
        }, null, 2));
      } catch (e) {
        console.error("Failed to write error log", e);
      }

      return NextResponse.json({
        success: true,
        partial: true,
        asin: createdAsin,
        details: `Created parent but failed on ${childErrors.length} children. Errors logged to latest_error.json`
      });
    }

    return NextResponse.json({
      success: true,
      asin: createdAsin
    });

  } catch (error: any) {
    console.error("Amazon push pipeline error:", error.message || error);
    
    // Save to file for debugging
    try {
      fs.writeFileSync(path.join(process.cwd(), 'latest_error.json'), JSON.stringify({
        timestamp: new Date().toISOString(),
        requestBody,
        error: error.message || error
      }, null, 2));
    } catch (e) {
      console.error("Failed to write error log", e);
    }

    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to push to Amazon'
    }, { status: 500 });
  }
}
