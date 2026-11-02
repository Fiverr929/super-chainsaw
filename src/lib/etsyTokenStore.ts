import fs from './workspaceFs.ts';
import { workspaceStorageContext } from './workspaceFs.ts';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

export interface EtsyTokens {
  refreshToken: string;
  shopId?: string;
}

export async function getEtsyRefreshToken(): Promise<string> {
  try {
    if (await exists(TOKENS_FILE)) {
      const fileContent = await fs.readFile(TOKENS_FILE, 'utf-8');
      const data = JSON.parse(fileContent);
      if (data.refreshToken) {
        return data.refreshToken;
      }
    }
  } catch (err) {
    console.warn("Failed to read tokens.json, falling back to process.env:", err);
  }
  return workspaceStorageContext() ? '' : process.env.ETSY_REFRESH_TOKEN || '';
}

export async function getEtsyShopId(): Promise<string | null> {
  try {
    if (await exists(TOKENS_FILE)) {
      const fileContent = await fs.readFile(TOKENS_FILE, 'utf-8');
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

export async function saveEtsyRefreshToken(refreshToken: string, shopId?: string): Promise<void> {
  try {
    let existingData: Partial<EtsyTokens> = {};
    if (await exists(TOKENS_FILE)) {
      try {
        existingData = JSON.parse(await fs.readFile(TOKENS_FILE, 'utf-8'));
      } catch {}
    }
    
    const newData: EtsyTokens = { ...existingData, refreshToken };
    if (shopId) {
      newData.shopId = shopId;
    }
    
    await fs.writeFile(TOKENS_FILE, JSON.stringify(newData, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to save tokens.json:", err);
    throw new Error('Failed to persist the refreshed Etsy credentials. Check workspace write permissions.', { cause: err });
  }
}

async function exists(file: string) { try { await fs.access(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }
