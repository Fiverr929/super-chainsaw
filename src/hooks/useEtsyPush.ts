import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';

export function useEtsyPush(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>
) {
  const triggerEtsyPush = useCallback((row: number, actionType: string): Promise<void> => {
    return new Promise((resolve) => {
      const newData = [...dataRef.current];
      newData[row] = { ...newData[row], status: "Pushing..." };
      dataRef.current = newData;
      setData(newData);

      const rowDataToPush = { 
        ...dataRef.current[row],
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
        
        const newData = [...dataRef.current];
        newData[row] = { ...newData[row], status: "Error" };
        dataRef.current = newData;
        setData(newData);
        resolve();
      });
    });
  }, [dataRef, setData]);

  return { triggerEtsyPush };
}
