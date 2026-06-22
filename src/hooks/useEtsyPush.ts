import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';

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

      fetch('/api/etsy/push', {
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
            const key = sheetType === 'digital'
              ? 'workstation_v2_grid_data_etsy_digital'
              : 'workstation_v2_grid_data_etsy_physical';
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
            const key = sheetType === 'digital'
              ? 'workstation_v2_grid_data_etsy_digital'
              : 'workstation_v2_grid_data_etsy_physical';
            const saved = localStorage.getItem(key);
            if (saved) {
               const parsed = JSON.parse(saved);
               parsed[row] = { ...parsed[row], status: "Error" };
               localStorage.setItem(key, JSON.stringify(parsed));
            }
        }
        resolve();
      });
    });
  }, [dataRef, setData, sheetType]);

  return { triggerEtsyPush };
}
