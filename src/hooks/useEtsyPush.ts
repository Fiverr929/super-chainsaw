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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

      const executeEtsyPush = (finalRowData: typeof rowDataToPush) => {
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
              const newData = [...dataRef.current];
              if (pushData.success) {
                newData[row] = { ...newData[row], status: "Published", listing_id: pushData.listing_id?.toString() || "" };
                toast.success("Successfully pushed to Etsy!");
              } else {
                let errMsg = pushData.details?.error || pushData.details || pushData.error || "Unknown Error";
                if (typeof errMsg === 'object') {
                  errMsg = JSON.stringify(errMsg, null, 2);
                }
                toast.error(`Etsy API Error:\n${errMsg}`);
                newData[row] = { ...newData[row], status: "Error" };
              }
              dataRef.current = newData;
              setData(newData);
          } else {
              const key = getEtsyGridStorageKey(sheetType);
              const saved = localStorage.getItem(key);
              if (saved) {
                 const parsed = JSON.parse(saved);
                 if (pushData.success) {
                    parsed[row] = { ...parsed[row], status: "Published", listing_id: pushData.listing_id?.toString() || "" };
                    toast.success("Successfully pushed background task to Etsy!");
                 } else {
                    let errMsg = pushData.details?.error || pushData.details || pushData.error || "Unknown Error";
                    if (typeof errMsg === 'object') {
                      errMsg = JSON.stringify(errMsg, null, 2);
                    }
                    toast.error(`Etsy API Error (Background Task):\n${errMsg}`);
                    parsed[row] = { ...parsed[row], status: "Error" };
                 }
                 localStorage.setItem(key, JSON.stringify(parsed));
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
          
          if (sheetRef.current === sheetType) {
              const newData = [...dataRef.current];
              newData[row] = { ...newData[row], status: "Error" };
              dataRef.current = newData;
              setData(newData);
          } else {
              const key = getEtsyGridStorageKey(sheetType);
              const saved = localStorage.getItem(key);
              if (saved) {
                 const parsed = JSON.parse(saved);
                 parsed[row] = { ...parsed[row], status: "Error" };
                 localStorage.setItem(key, JSON.stringify(parsed));
              }
          }
          resolve();
        });
      };

      if (sheetType === 'physical' && rowDataToPush.enable_pod && actionType === "all") {
        // Intercept and do Printify first
        const preset = {
          enable_pod: rowDataToPush.enable_pod,
          pod_blueprint_id: rowDataToPush.pod_blueprint_id,
          pod_print_provider_id: rowDataToPush.pod_print_provider_id,
          pod_position: rowDataToPush.pod_position
        };

        if (preset) {
           toast.loading("Creating product in Printify...", { id: `printify-${row}` });
           fetch('/api/printify/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ preset, rowData: rowDataToPush })
           })
           .then(res => res.json())
           .then(printifyData => {
              toast.dismiss(`printify-${row}`);
              if (printifyData.success) {
                 toast.success("Printify product created! Pushing to Etsy...");
                 
                 // Inject SKUs into Etsy payload here
                 // The Printify product has variants with actual SKUs
                 const updatedRowData = { ...rowDataToPush };
                 
                 if (updatedRowData.variations && updatedRowData.variations.combinations && printifyData.printify_product?.variants) {
                    // We map the Etsy combination to the Printify SKU
                    // For example, if combination has "White" and Printify variant title has "White"
                     updatedRowData.variations.combinations = updatedRowData.variations.combinations.map(combo => {
                        const comboValues = Object.values(combo.values).map(v => String(v).toLowerCase().trim());
                        
                        const matchedPrintifyVariant = printifyData.printify_product.variants.find((pv: any) => {
                           const pvTitle = pv.title.toLowerCase();
                           // Ensure all combo values are in the printify title
                           return comboValues.every(cv => pvTitle.includes(cv));
                        });

                        if (matchedPrintifyVariant) {
                           return { ...combo, skuTemplate: matchedPrintifyVariant.sku };
                        }
                        return combo;
                    });
                 }
                 
                 executeEtsyPush(updatedRowData);
              } else {
                 toast.error(`Printify Error: ${printifyData.error}`);
                 const newData = [...dataRef.current];
                 newData[row] = { ...newData[row], status: "Error" };
                 dataRef.current = newData;
                 setData(newData);
                 resolve();
              }
           })
           .catch(err => {
              toast.dismiss(`printify-${row}`);
              console.error(err);
              toast.error("Failed to connect to Printify");
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
  }, [dataRef, setData, sheetType, sheetRef]);

  return { triggerEtsyPush };
}
