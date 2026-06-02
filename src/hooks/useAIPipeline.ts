import { useCallback } from 'react';
import type { RowData } from '@/components/SpreadsheetGrid';
import toast from 'react-hot-toast';
import { ETSY_TAXONOMY_MAP } from "@/lib/etsyConstants";
import { taxonomyCache } from "@/hooks/useEtsyTaxonomy";

export function useAIPipeline(
  dataRef: React.MutableRefObject<RowData[]>,
  setData: React.Dispatch<React.SetStateAction<RowData[]>>
) {
  const triggerAIGeneration = useCallback((row: number, forceRegenerate: string[] = []): Promise<void> => {
    return new Promise((resolve) => {
      // Optimistically set status to 'Generating...' to lock the row
    const updatedArray = [...dataRef.current];
    updatedArray[row] = { ...updatedArray[row], status: "Generating..." };
    dataRef.current = updatedArray;
    setData(updatedArray);

    const rowData = dataRef.current[row];
    const imagePaths = (rowData.images || "").split(',').map(s => s.trim()).filter(Boolean);

    const toGen = Array.isArray(forceRegenerate) && forceRegenerate.length > 0 
      ? forceRegenerate 
      : ["title", "description", "tags", "attributes"];

    // Prepare prompt
    let prompt = `You are an expert Etsy SEO copywriter. Generate the requested fields for a new listing.
Context/Product Description: ${rowData.context || "A digital product."}
Category: ${rowData.category || "Store Graphics"}\n`;

    if (rowData.ai_title_rules) prompt += `Title Rules: ${rowData.ai_title_rules}\n`;
    if (rowData.ai_desc_rules) prompt += `Description Rules: ${rowData.ai_desc_rules}\n`;
    if (rowData.ai_tag_rules) prompt += `Tag Rules: ${rowData.ai_tag_rules}\n`;

    prompt += `\nYou must respond ONLY with a raw, valid JSON object containing exactly the fields requested. Do NOT wrap the JSON in markdown code blocks. Do NOT include any explanations.\n\n`;

    const jsonFormat: any = {};
    if (toGen.includes("title")) jsonFormat.title = "Optimized listing title";
    if (toGen.includes("description")) jsonFormat.description = "Optimized listing description (Use basic HTML like <ul>, <li>, <strong>, <br/> if formatting is needed)";
    if (toGen.includes("tags")) jsonFormat.tags = "comma-separated tags";

    // Dynamically inject properties for AI selection
    const taxId = ETSY_TAXONOMY_MAP[rowData.category || ""];
    if (taxId && (toGen.includes("attributes") || toGen.includes("all"))) {
      const props = taxonomyCache[taxId] || [];
      if (props.length > 0) {
        prompt += `\nYou MUST select the most appropriate value for each of the following attributes. If none match perfectly, choose the closest or leave it empty.\n`;
        props.forEach(p => {
            const opts = p.possible_values.map(v => v.name).join('", "');
            prompt += `- ${p.display_name} (JSON key: prop_${p.property_id}): Options: ["", "${opts}"]\n`;
            jsonFormat[`prop_${p.property_id}`] = `string (one of the options above, or empty)`;
        });
      }
    }

    prompt += `\nReturn a JSON object in exactly this format:\n${JSON.stringify(jsonFormat, null, 2)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); 

    fetch('/api/generate', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: prompt,
        imagePaths: imagePaths,
        existingData: { ...rowData },
        forceRegenerate: forceRegenerate
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
        ...aiData,
        status: aiData.error ? "Error" : "Review"
      };
      dataRef.current = newData;
      setData(newData);

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
      const prev2 = dataRef.current;
      const newData = [...prev2];
      newData[row] = { ...newData[row], status: "Error" };
      dataRef.current = newData;
      setData(newData);
      
      if (err.name === 'AbortError') {
        toast.error("AI Generation timed out after 3 minutes. The Google Gemini API might be congested. Please try again.");
      } else {
        toast.error("Failed to parse AI response or network error.");
      }
      resolve(); // Resolve to prevent queue from blocking indefinitely
    });
    });
  }, [dataRef, setData]);

  const triggerFolderAutomation = useCallback((row: number, folderName: string) => {
    if (folderName.trim() === "") return;

    const optimisticArray = [...dataRef.current];
    // No longer aggressively overriding user data with hardcoded Store Graphics values!
    dataRef.current = optimisticArray;
    setData(optimisticArray);

    fetch(`/api/assets?folder=${encodeURIComponent(folderName.trim())}`)
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
  }, [dataRef, setData, triggerAIGeneration]);

  return { triggerAIGeneration, triggerFolderAutomation };
}
