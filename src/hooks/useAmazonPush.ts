import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';
import { getAmazonPushResult, type AmazonPushResponse } from '@/lib/listingWorkflow';

const AMAZON_GRID_STORAGE_KEY = 'workstation_v2_grid_data_amazon';
type AmazonUpdateType = 'all' | 'offer' | 'images' | 'details' | 'sync';

function persistAmazonRow(row: number, rowData: RowData) {
  if (typeof window === 'undefined') return;

  try {
    const saved = localStorage.getItem(AMAZON_GRID_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (Array.isArray(parsed)) {
      parsed[row] = { ...(parsed[row] || {}), ...rowData };
      localStorage.setItem(AMAZON_GRID_STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch (error) {
    console.warn('Failed to persist Amazon row status:', error);
  }
}

export function useAmazonPush(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>
) {
  const triggerAmazonPush = useCallback((row: number, updateType: AmazonUpdateType = "all"): Promise<void> => {
    return new Promise((resolve) => {
      const newData = [...dataRef.current];
      const workingStatus = updateType === "all" ? "Pushing..." : (updateType === "offer" ? "Updating Offer..." : "Updating...");
      newData[row] = { ...newData[row], status: workingStatus };
      dataRef.current = newData;
      setData(newData);

      // Get public tunnel URL if configured
      const tunnelUrl = typeof window !== "undefined" ? (localStorage.getItem("workstation_v2_amazon_tunnel_url") || "").trim() : "";

      const rowDataToPush = { 
        ...dataRef.current[row],
        tunnelUrl,
        updateType
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

      fetch('/api/amazon/push', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rowDataToPush)
      })
      .then(res => {
        clearTimeout(timeoutId);
        return res.json();
      })
      .then(pushData => {
        const currentData = [...dataRef.current];
        const result = getAmazonPushResult(pushData as AmazonPushResponse, currentData[row].asin || "");
        const parentSku = typeof pushData.sku === 'string'
          ? pushData.sku
          : (typeof pushData.parentSku === 'string' ? pushData.parentSku : currentData[row].sku);
        currentData[row] = {
          ...currentData[row],
          status: result.status,
          asin: result.asin,
          sku: parentSku
        };
        persistAmazonRow(row, currentData[row]);
        if (result.isError) {
          toast.error(`Amazon API Error:\n${result.message}`);
        } else {
          toast.success(result.message);
        }
        dataRef.current = currentData;
        setData(currentData);
        resolve();
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.error("Amazon push failed:", err);
        
        if (err.name === 'AbortError') {
          toast.error("Amazon Push timed out after 3 minutes.");
        } else {
          toast.error("Network error while pushing to Amazon.");
        }
        
        const currentData = [...dataRef.current];
        currentData[row] = { ...currentData[row], status: "Error" };
        persistAmazonRow(row, currentData[row]);
        dataRef.current = currentData;
        setData(currentData);
        resolve();
      });
    });
  }, [dataRef, setData]);

  return { triggerAmazonPush };
}
