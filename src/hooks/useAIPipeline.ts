import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';

export function useAIPipeline(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>
) {
  const triggerAIGeneration = useCallback((row: number) => {
    // Optimistically set status to 'Generating...' to lock the row
    const updatedArray = [...dataRef.current];
    updatedArray[row] = { ...updatedArray[row], status: "Generating..." };
    dataRef.current = updatedArray;
    setData(updatedArray);

    // Calculate exact number of images in this row and pass their paths
    const imagesList = dataRef.current[row].images || "";
    const imagePaths = imagesList.split(',').map(s => s.trim()).filter(Boolean);

    // Build context from whatever the user has already provided
    let promptContext = dataRef.current[row].context || "";
    if (dataRef.current[row].folder) promptContext += `\nFolder/Product Name: ${dataRef.current[row].folder}`;
    if (dataRef.current[row].category) promptContext += `\nProduct Category: ${dataRef.current[row].category}`;
    if (dataRef.current[row].digital_file) promptContext += `\nFormat: Digital Download (NOT a physical item)`;
    if (dataRef.current[row].title) promptContext += `\nTitle: ${dataRef.current[row].title}`;
    if (dataRef.current[row].description) promptContext += `\nDescription: ${dataRef.current[row].description}`;

    // Prepare existing data payload so backend knows what to skip
    const existingDataPayload = { ...dataRef.current[row] };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); 

    fetch('/api/generate', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        context: promptContext,
        imagePaths: imagePaths,
        existingData: existingDataPayload
      })
    })
    .then(res => {
      clearTimeout(timeoutId);
      return res.json();
    })
    .then(aiData => {
      const prev2 = dataRef.current;
      const newData = [...prev2];
      newData[row] = {
        ...newData[row],
        title: aiData.title || newData[row].title,
        description: aiData.description || newData[row].description,
        tags: aiData.tags || newData[row].tags,
        alt_text: (aiData.alt_texts && Array.isArray(aiData.alt_texts)) ? aiData.alt_texts.join(" | ") : newData[row].alt_text,
        primary_color: aiData.primary_color || newData[row].primary_color,
        occasion: aiData.occasion || newData[row].occasion,
        celebration: aiData.celebration || newData[row].celebration,
        subject: aiData.subject || newData[row].subject,
        status: aiData.error ? "Error" : "Review"
      };
      dataRef.current = newData;
      setData(newData);

      if (aiData.error) {
        toast.error(`AI Generation Failed:\n${aiData.error}`);
      } else {
        toast.success("AI Generation Complete");
      }
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.error("AI Generation failed:", err);
      const prev2 = dataRef.current;
      const newData = [...prev2];
      newData[row] = { ...newData[row], status: "Error" };
      dataRef.current = newData;
      setData(newData);
      
      if (err.name === 'AbortError') {
        toast.error("AI Generation timed out after 3 minutes. The Google Gemini API might be congested. Please try again.");
      } else {
        toast.error("AI Generation request completely failed to send.");
      }
    });
  }, [dataRef, setData]);

  const triggerFolderAutomation = useCallback((row: number, folderName: string) => {
    if (folderName.trim() === "") return;

    const optimisticArray = [...dataRef.current];
    optimisticArray[row] = {
       ...optimisticArray[row],
       category: optimisticArray[row].category || "Store Graphics",
       price: optimisticArray[row].price || "3.99",
       quantity: optimisticArray[row].quantity || "999"
    };
    dataRef.current = optimisticArray;
    setData(optimisticArray);

    fetch(`/api/assets?folder=${encodeURIComponent(folderName.trim())}`)
      .then(res => res.json())
      .then(assetData => {
         if (assetData && !assetData.error) {
            const updatedArray = [...dataRef.current];
            updatedArray[row] = {
               ...updatedArray[row],
               images: assetData.images || updatedArray[row].images,
               video: assetData.video || updatedArray[row].video,
               digital_file: assetData.digital_file || updatedArray[row].digital_file
            };
            dataRef.current = updatedArray;
            setData(updatedArray);
            
            // Chain the AI trigger now that assets are loaded!
            triggerAIGeneration(row);
         } else {
            toast.error(`Folder Scan Failed: ${assetData.error || "Unknown error"}. Make sure the folder exists and is spelled correctly.`);
         }
      })
      .catch(err => {
         console.error("Asset scan failed:", err);
         toast.error("Network error while trying to scan folder.");
      });
  }, [dataRef, setData, triggerAIGeneration]);

  return { triggerAIGeneration, triggerFolderAutomation };
}
