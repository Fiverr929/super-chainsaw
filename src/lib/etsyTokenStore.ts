import fs from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

export interface EtsyTokens {
  refreshToken: string;
  shopId?: string;
}

export function getEtsyRefreshToken(): string {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const fileContent = fs.readFileSync(TOKENS_FILE, 'utf-8');
      const data = JSON.parse(fileContent);
      if (data.refreshToken) {
        return data.refreshToken;
      }
    }
  } catch (err) {
    console.warn("Failed to read tokens.json, falling back to process.env:", err);
  }
  return process.env.ETSY_REFRESH_TOKEN || '';
}

export function getEtsyShopId(): string | null {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const fileContent = fs.readFileSync(TOKENS_FILE, 'utf-8');
      const data = JSON.parse(fileContent);
      if (data.shopId) {
        return data.shopId;
      }
    }
  } catch (err) {
    console.warn("Failed to read shopId from tokens.json:", err);
  }
  return null;
}

export function saveEtsyRefreshToken(refreshToken: string, shopId?: string): void {
  try {
    let existingData = {};
    if (fs.existsSync(TOKENS_FILE)) {
      try {
        existingData = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
      } catch {}
    }
    
    const newData: any = { ...existingData, refreshToken };
    if (shopId) {
      newData.shopId = shopId;
    }
    
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(newData, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to save tokens.json:", err);
  }
}
