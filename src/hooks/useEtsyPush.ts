import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';

export function useEtsyPush(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>
) {
  const triggerEtsyPush = useCallback((row: number, actionType: string) => {
    setData((prev) => {
      const newData = [...prev];
      newData[row] = { ...newData[row], status: "Pushing..." };
      dataRef.current = newData;
      return newData;
    });

    const rowDataToPush = { 
      ...dataRef.current[row],
      updateType: actionType === "Update Text & SEO" ? "text" :
                  actionType === "Update Images" ? "images" : 
                  actionType === "Update Digital Files" ? "files" : "all"
    };

    fetch('/api/etsy/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rowDataToPush)
    })
    .then(res => res.json())
    .then(pushData => {
      setData((prev) => {
        const newData = [...prev];
        if (pushData.success) {
          newData[row] = { ...newData[row], status: "Published", listing_id: pushData.listing_id?.toString() || "" };
        } else {
          const errMsg = pushData.details?.error || pushData.error || "Unknown Error";
          alert(`Etsy API Error:\n${errMsg}`);
          newData[row] = { ...newData[row], status: "Error" };
        }
        dataRef.current = newData;
        return newData;
      });
    })
    .catch(err => {
      console.error("Push failed:", err);
      setData((prev) => {
        const newData = [...prev];
        newData[row] = { ...newData[row], status: "Error" };
        dataRef.current = newData;
        return newData;
      });
    });
  }, [dataRef, setData]);

  return { triggerEtsyPush };
}
