import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';

export function useAIPipeline(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>,
  sheetType: 'digital' | 'physical',
  sheetRef: React.MutableRefObject<'digital' | 'physical'>
) {
  const triggerAIGeneration = useCallback((row: number, forceRegenerate: string[] = []): Promise<void> => {
    return new Promise((resolve) => {
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
    if (sheetType === 'digital') {
      if (dataRef.current[row].digital_file) promptContext += `\nFormat: Digital Download (NOT a physical item)`;
    } else {
      promptContext += `\nFormat: Physical Product (NOT a digital download)`;
    }
    if (dataRef.current[row].title) promptContext += `\nTitle: ${dataRef.current[row].title}`;
    if (dataRef.current[row].description) promptContext += `\nDescription: ${dataRef.current[row].description}`;

    // Prepare existing data payload so backend knows what to skip
    const existingDataPayload = { ...dataRef.current[row] };

    const aiRules = {
      title: dataRef.current[row].ai_title_rules || "",
      description: dataRef.current[row].ai_desc_rules || "",
      tags: dataRef.current[row].ai_tag_rules || "",
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); 

    fetch('/api/generate', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        context: promptContext,
        imagePaths: imagePaths,
        existingData: existingDataPayload,
        aiRules: aiRules,
        forceRegenerate: forceRegenerate
      })
    })
    .then(res => {
      clearTimeout(timeoutId);
      return res.json();
    })
    .then(aiData => {
            const getVal = (aiVal: string | undefined, existingVal: string | undefined) => {
          if (aiVal === undefined) {
            return existingVal === "Auto" ? "None" : (existingVal || "");
          }
          if (aiVal === "") return "None";
          return aiVal;
        };

      const updatedRow = {
        title: aiData.title || existingDataPayload.title,
        description: aiData.description || existingDataPayload.description,
        tags: aiData.tags || existingDataPayload.tags,
        alt_text: (aiData.alt_texts && Array.isArray(aiData.alt_texts)) ? aiData.alt_texts.join(' | ') : existingDataPayload.alt_text,
        primary_color: getVal(aiData.primary_color, existingDataPayload.primary_color),
        secondary_color: getVal(aiData.secondary_color, existingDataPayload.secondary_color),
        materials: getVal(aiData.materials, existingDataPayload.materials),
        sleeve_length: getVal(aiData.sleeve_length, existingDataPayload.sleeve_length),
        neckline: getVal(aiData.neckline, existingDataPayload.neckline),
        clothing_style: getVal(aiData.clothing_style, existingDataPayload.clothing_style),
        capacity: getVal(aiData.capacity, existingDataPayload.capacity),
        dishwasher_safe: getVal(aiData.dishwasher_safe, existingDataPayload.dishwasher_safe),
        microwave_safe: getVal(aiData.microwave_safe, existingDataPayload.microwave_safe),
        orientation: getVal(aiData.orientation, existingDataPayload.orientation),
        framing: getVal(aiData.framing, existingDataPayload.framing),
        aspect_ratio: getVal(aiData.aspect_ratio, existingDataPayload.aspect_ratio),
        occasion: getVal(aiData.occasion, existingDataPayload.occasion),
        celebration: getVal(aiData.celebration, existingDataPayload.celebration),
        subject: getVal(aiData.subject, existingDataPayload.subject),
        graphic: getVal(aiData.graphic, existingDataPayload.graphic),
        status: aiData.error ? 'Error' : 'Review'
      };

      if (sheetRef.current === sheetType) {
        const prev2 = dataRef.current;
        const newData = [...prev2];
        newData[row] = {
          ...newData[row],
          ...updatedRow
        };
        dataRef.current = newData;
        setData(newData);
      } else {
        const key = sheetType === 'digital' ? 'workstation_v2_grid_data' : 'workstation_v2_grid_data_physical';
        const saved = localStorage.getItem(key);
        if (saved) {
           const parsed = JSON.parse(saved);
           parsed[row] = { ...parsed[row], ...updatedRow };
           localStorage.setItem(key, JSON.stringify(parsed));
        }
      }

      if (aiData.error) {
        toast.error(`AI Generation Failed:\n${aiData.error}`);
        resolve(); // Resolve anyway so queue continues
      } else {
        toast.success("AI Generation Complete");
        resolve();
      }
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.error("AI Generation failed:", err);
      if (sheetRef.current === sheetType) {
        const prev2 = dataRef.current;
        const newData = [...prev2];
        newData[row] = { ...newData[row], status: 'Error' };
        dataRef.current = newData;
        setData(newData);
      } else {
        const key = sheetType === 'digital' ? 'workstation_v2_grid_data' : 'workstation_v2_grid_data_physical';
        const saved = localStorage.getItem(key);
        if (saved) {
           const parsed = JSON.parse(saved);
           parsed[row] = { ...parsed[row], status: 'Error' };
           localStorage.setItem(key, JSON.stringify(parsed));
        }
      }
      
      if (err.name === 'AbortError') {
        toast.error("AI Generation timed out after 3 minutes. The Google Gemini API might be congested. Please try again.");
      } else {
        toast.error("Failed to parse AI response or network error.");
      }
      resolve(); // Resolve to prevent queue from blocking indefinitely
    });
    });
  }, [dataRef, setData, sheetType, sheetRef]);

  const triggerFolderAutomation = useCallback((row: number, folderName: string) => {
    if (folderName.trim() === "") return;

    const optimisticArray = [...dataRef.current];
    // No longer aggressively overriding user data with hardcoded Store Graphics values!
    dataRef.current = optimisticArray;
    setData(optimisticArray);

    fetch(`/api/assets?folder=${encodeURIComponent(folderName.trim())}&type=${sheetType}`)
      .then(res => res.json())
      .then(assetData => {
         if (assetData && !assetData.error) {
            const updatedArray = [...dataRef.current];
            updatedArray[row] = {
               ...updatedArray[row],
               images: assetData.images,
               video: assetData.video,
               digital_file: assetData.digital_file
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
  }, [dataRef, setData, triggerAIGeneration, sheetType, sheetRef]);

  return { triggerAIGeneration, triggerFolderAutomation };
}
