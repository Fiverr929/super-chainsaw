import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';

export function useAmazonPush(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>
) {
  const triggerAmazonPush = useCallback((row: number): Promise<void> => {
    return new Promise((resolve) => {
      const newData = [...dataRef.current];
      newData[row] = { ...newData[row], status: "Pushing..." };
      dataRef.current = newData;
      setData(newData);

      // Get public tunnel URL if configured
      const tunnelUrl = typeof window !== "undefined" ? localStorage.getItem("workstation_v2_amazon_tunnel_url") || "" : "";

      const rowDataToPush = { 
        ...dataRef.current[row],
        tunnelUrl,
        updateType: "all"
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
        if (pushData.success && !pushData.partial) {
          currentData[row] = { 
            ...currentData[row], 
            status: "Published", 
            asin: pushData.asin || currentData[row].asin || "" 
          };
          toast.success("Successfully pushed listing to Amazon!");
        } else if (pushData.success && pushData.partial) {
          currentData[row] = {
            ...currentData[row],
            status: "Partial Error",
            asin: pushData.asin || currentData[row].asin || ""
          };
          toast.error(pushData.details || "Amazon created the parent listing, but one or more variants failed.");
        } else {
          let errMsg = pushData.details?.error || pushData.details || pushData.error || "Unknown Error";
          if (typeof errMsg === 'object') {
            errMsg = JSON.stringify(errMsg, null, 2);
          }
          toast.error(`Amazon API Error:\n${errMsg}`);
          currentData[row] = { ...currentData[row], status: "Error" };
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
        dataRef.current = currentData;
        setData(currentData);
        resolve();
      });
    });
  }, [dataRef, setData]);

  return { triggerAmazonPush };
}
