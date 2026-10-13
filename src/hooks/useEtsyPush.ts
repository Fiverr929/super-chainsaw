import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';
import { getEtsyGridStorageKey } from '@/lib/listingWorkflow';

export function useEtsyPush(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>,
  sheetType: 'digital' | 'physical',
  sheetRef: React.MutableRefObject<'digital' | 'physical'>
) {
  const updateRowStatus = useCallback((
    row: number,
    targetSheet: 'digital' | 'physical',
    status: string,
    listingId?: string,
    printifyProductId?: string
  ) => {
    if (sheetRef.current === targetSheet) {
      const newData = [...dataRef.current];
      if (!newData[row]) return;
      newData[row] = {
        ...newData[row],
        status,
        ...(listingId !== undefined ? { listing_id: listingId } : {}),
        ...(printifyProductId !== undefined ? { printify_product_id: printifyProductId } : {})
      };
      dataRef.current = newData;
      setData(newData);
      return;
    }

    try {
      const key = getEtsyGridStorageKey(targetSheet);
      const saved = localStorage.getItem(key);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || !parsed[row]) return;
      parsed[row] = {
        ...parsed[row],
        status,
        ...(listingId !== undefined ? { listing_id: listingId } : {}),
        ...(printifyProductId !== undefined ? { printify_product_id: printifyProductId } : {})
      };
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch (error) {
      console.error(`Failed to update background Etsy ${targetSheet} row ${row + 1}:`, error);
    }
  }, [dataRef, setData, sheetRef]);

  const triggerEtsyPush = useCallback((row: number, actionType: string): Promise<void> => {
    return new Promise((resolve) => {
      const newData = [...dataRef.current];
      newData[row] = { ...newData[row], status: "Pushing..." };
      dataRef.current = newData;
      setData(newData);

      const rowDataToPush = { 
        ...dataRef.current[row],
        listingType: sheetType,
        updateType: actionType === "Update Text & SEO" ? "text" :
                    actionType === "Update Images Only" ? "images" : 
                    actionType === "Update Video Only" ? "video" : 
                    actionType === "Update Digital Files" ? "files" : "all"
      };

      const executeEtsyPush = (finalRowData: typeof rowDataToPush) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // Etsy request only
        fetch('/api/etsy/push', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalRowData)
        })
        .then(res => {
          clearTimeout(timeoutId);
          return res.json();
        })
        .then(pushData => {
          if (sheetRef.current === sheetType) {
              if (pushData.success) {
                updateRowStatus(row, sheetType, "Published", pushData.listing_id?.toString() || "");
                toast.success("Successfully pushed to Etsy!");
              } else {
                let errMsg = pushData.details?.error || pushData.details || pushData.error || "Unknown Error";
                if (typeof errMsg === 'object') {
                  errMsg = JSON.stringify(errMsg, null, 2);
                }
                toast.error(`Etsy API Error:\n${errMsg}`);
                updateRowStatus(row, sheetType, "Error");
              }
          } else {
              if (pushData.success) {
                 updateRowStatus(row, sheetType, "Published", pushData.listing_id?.toString() || "");
                 toast.success("Successfully pushed background task to Etsy!");
              } else {
                 let errMsg = pushData.details?.error || pushData.details || pushData.error || "Unknown Error";
                 if (typeof errMsg === 'object') {
                   errMsg = JSON.stringify(errMsg, null, 2);
                 }
                 toast.error(`Etsy API Error (Background Task):\n${errMsg}`);
                 updateRowStatus(row, sheetType, "Error");
              }
          }
          resolve();
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.error("Push failed:", err);
          
          if (err.name === 'AbortError') {
            toast.error("Etsy Push timed out after 3 minutes. The server might be congested.");
          } else {
            toast.error("Network error while pushing to Etsy.");
          }
          
          updateRowStatus(row, sheetType, "Error");
          resolve();
        });
      };

      if (sheetType === 'physical' && rowDataToPush.enable_pod && actionType === "all" && !rowDataToPush.listing_id) {
        // Intercept and do Printify first
        const preset = {
          enable_pod: rowDataToPush.enable_pod,
          pod_blueprint_id: rowDataToPush.pod_blueprint_id,
          pod_print_provider_id: rowDataToPush.pod_print_provider_id,
          pod_position: rowDataToPush.pod_position
        };

        if (preset) {
           toast.loading("Publishing through Printify...", { id: `printify-${row}` });
           fetch('/api/printify/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                preset,
                rowData: rowDataToPush,
                shopId: Number(localStorage.getItem('workstation_printify_shop_id')) || undefined
              })
           })
           .then(res => res.json())
           .then(printifyData => {
              toast.dismiss(`printify-${row}`);
              if (printifyData.success) {
                 const productId = String(printifyData.product_id);
                 if (!printifyData.listing_id) {
                    updateRowStatus(row, sheetType, "Publishing", undefined, productId);
                    toast.success("Printify is publishing to Etsy. Retry this row shortly to check the link.");
                    resolve();
                    return;
                 }
                 const listingId = String(printifyData.listing_id);
                 updateRowStatus(row, sheetType, "Publishing", listingId, productId);
                 if (rowDataToPush.images?.trim()) {
                    toast.loading("Applying listing images on Etsy...", { id: `etsy-images-${row}` });
                    executeEtsyPush({ ...rowDataToPush, listing_id: listingId, updateType: "images" });
                 } else {
                    updateRowStatus(row, sheetType, "Published", listingId, productId);
                    toast.success("Published on Etsy through Printify.");
                    resolve();
                 }
              } else {
                 toast.error(`Printify Error: ${printifyData.error}`);
                 updateRowStatus(row, sheetType, "Error", undefined, printifyData.product_id ? String(printifyData.product_id) : undefined);
                 resolve();
              }
           })
           .catch(err => {
              toast.dismiss(`printify-${row}`);
              console.error(err);
              toast.error("Failed to connect to Printify");
              updateRowStatus(row, sheetType, "Error");
              resolve();
           });
        } else {
           // Preset not found locally, just push to Etsy
           executeEtsyPush(rowDataToPush);
        }
      } else {
        // Normal Etsy Push
        executeEtsyPush(rowDataToPush);
      }
    });
  }, [dataRef, setData, sheetType, sheetRef, updateRowStatus]);

  const triggerEtsySync = useCallback(async (row: number): Promise<void> => {
    const listingId = dataRef.current[row]?.listing_id;
    if (!listingId) { toast.error('This row has no Etsy listing ID to sync.'); return; }
    try {
      const response = await fetch(`/api/etsy/listing-status?listingId=${encodeURIComponent(listingId)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sync Etsy status.');
      updateRowStatus(row, sheetType, result.status, listingId);
      toast.success(`Etsy status: ${result.status}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not sync Etsy status.'); }
  }, [dataRef, sheetType, updateRowStatus]);

  return { triggerEtsyPush, triggerEtsySync };
}
