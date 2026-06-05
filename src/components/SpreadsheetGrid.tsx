"use client";

import React, { useCallback, useState, useRef } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import DataEditor, {
  DataEditorRef,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  TextCell,
  GridSelection,
  Theme,
  Rectangle
} from "@glideapps/glide-data-grid";
import { allCells } from "@glideapps/glide-data-grid-cells";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  ETSY_DIGITAL_CATEGORIES,
  ETSY_PHYSICAL_CATEGORIES,
  ETSY_SUBJECTS,
  ETSY_COLORS,
  ETSY_OCCASIONS,
  ETSY_CELEBRATIONS,
  ETSY_STATUSES,
  categorySupportsOccasion,
  categorySupportsCelebration,
  categorySupportsSubject,
  categorySupportsGraphic,
  ETSY_GRAPHICS,
  ETSY_SLEEVE_LENGTH,
  ETSY_NECKLINE,
  ETSY_CLOTHING_STYLE,
  ETSY_MUG_CAPACITY,
  ETSY_ORIENTATION,
  ETSY_FRAMING,
  ETSY_ASPECT_RATIO
} from "@/lib/etsyConstants";
import { useAIPipeline } from "@/hooks/useAIPipeline";
import { useEtsyPush } from "@/hooks/useEtsyPush";
import FolderImporterModal from "./FolderImporterModal";
import PresetManagerModal, { PresetVariations } from "./PresetManagerModal";
import { FolderPlus, Layers, ChevronDown, Trash2 } from "lucide-react";

const imageCache: Record<string, { absoluteUrlArray: string[], thumbnailUrls: string[] }> = {};
const tagCache: Record<string, string[]> = {};

const DIGITAL_COLUMNS: GridColumn[] = [
  { title: "Folder", id: "folder", width: 120 },
  { title: "Images", id: "images", width: 150 },
  { title: "Category", id: "category", width: 150 },
  { title: "Video", id: "video", width: 120 },
  { title: "Status", id: "status", width: 100 },
  { title: "Listing ID", id: "listing_id", width: 120 },
  { title: "Context", id: "context", width: 200 },
  { title: "Digital File", id: "digital_file", width: 150 },
  { title: "Title", id: "title", width: 250 },
  { title: "Description", id: "description", width: 300 },
  { title: "Tags", id: "tags", width: 200 },
  { title: "Price", id: "price", width: 80 },
  { title: "Quantity", id: "quantity", width: 80 },
  { title: "Section", id: "section", width: 120 },
  { title: "Primary Color", id: "primary_color", width: 120 },
  { title: "Occasion", id: "occasion", width: 120 },
  { title: "Celebration", id: "celebration", width: 120 },
  { title: "Subject / Graphic", id: "subject", width: 150 },
];

const PHYSICAL_COLUMNS: GridColumn[] = [
  { title: "Folder", id: "folder", width: 120 },
  { title: "Images", id: "images", width: 150 },
  { title: "Category", id: "category", width: 150 },
  { title: "Video", id: "video", width: 120 },
  { title: "Status", id: "status", width: 100 },
  { title: "Listing ID", id: "listing_id", width: 120 },
  { title: "Context", id: "context", width: 200 },
  { title: "Shipping Profile", id: "shipping_profile", width: 180 },
  { title: "Title", id: "title", width: 250 },
  { title: "Description", id: "description", width: 300 },
  { title: "Tags", id: "tags", width: 200 },
  { title: "Price", id: "price", width: 80 },
  { title: "Quantity", id: "quantity", width: 80 },
  { title: "Variations", id: "variations", width: 150 },
  { title: "Section", id: "section", width: 120 },
  { title: "Attributes", id: "attributes", width: 200 },
  { title: "Processing Profile ID", id: "readiness_state_id", width: 150 },
];

export type RowData = {
  status: string;
  images?: string;
  video?: string;
  listing_id?: string;
  context?: string;
  folder?: string;
  digital_file: string;
  title: string;
  description?: string;
  tags: string;
  price: string;
  quantity: string;
  category: string;
  section: string;
  primary_color: string;
  occasion: string;
  celebration: string;
  subject: string;
  alt_text: string;
  who_made?: string;
  when_made?: string;
  is_supply?: string;
  renewal_options?: string;
  ai_title_rules?: string;
  ai_desc_rules?: string;
  ai_tag_rules?: string;
  shipping_profile?: string;
  readiness_state_id?: string;
  secondary_color?: string;
  graphic?: string;
  materials?: string;
  sleeve_length?: string;
  neckline?: string;
  clothing_style?: string;
  capacity?: string;
  dishwasher_safe?: string;
  microwave_safe?: string;
  orientation?: string;
  framing?: string;
  aspect_ratio?: string;
  variations?: PresetVariations;
  attributes?: string;
};

const emptyRowDigital: RowData = {
  status: "",
  listing_id: "",
  context: "",
  images: "",
  video: "",
  alt_text: "",
  digital_file: "",
  shipping_profile: "",
  title: "",
  description: "",
  tags: "",
  price: "",
  quantity: "",
  category: "",
  section: "",
  primary_color: "",
  occasion: "",
  celebration: "",
  subject: "",
  who_made: "",
  when_made: "",
  is_supply: "",
  renewal_options: "",
  ai_title_rules: "",
  ai_desc_rules: "",
  ai_tag_rules: "",
};

const emptyRowPhysical: RowData = {
  status: "",
  listing_id: "",
  context: "",
  images: "",
  video: "",
  alt_text: "",
  digital_file: "",
  shipping_profile: "",
  title: "",
  description: "",
  tags: "",
  price: "",
  quantity: "",
  category: "",
  section: "",
  primary_color: "",
  occasion: "",
  celebration: "",
  subject: "",
  who_made: "",
  when_made: "",
  is_supply: "",
  renewal_options: "",
  ai_title_rules: "",
  ai_desc_rules: "",
  ai_tag_rules: "",
  readiness_state_id: "",
  secondary_color: "",
  graphic: "",
  materials: "",
  sleeve_length: "",
  neckline: "",
  clothing_style: "",
  capacity: "",
  dishwasher_safe: "",
  microwave_safe: "",
  orientation: "",
  framing: "",
  aspect_ratio: "",
};

const getAttributesSummary = (row: RowData) => {
  const parts: string[] = [];
  if (row.primary_color) parts.push(`Color: ${row.primary_color}`);
  if (row.secondary_color) parts.push(`Sec Color: ${row.secondary_color}`);
  if (row.materials) parts.push(`Materials: ${row.materials}`);
  if (row.graphic && categorySupportsGraphic(row.category || "")) parts.push(`Graphic: ${row.graphic}`);
  if (row.occasion && categorySupportsOccasion(row.category || "")) parts.push(`Occasion: ${row.occasion}`);
  if (row.celebration && categorySupportsCelebration(row.category || "")) parts.push(`Celebration: ${row.celebration}`);
  if (row.subject && categorySupportsSubject(row.category || "")) parts.push(`Subject: ${row.subject}`);
  
  // Clothing details
  const isClothing = ["T-Shirts", "Sweatshirts & Hoodies"].includes(row.category || "");
  if (isClothing) {
    if (row.sleeve_length) parts.push(`Sleeve: ${row.sleeve_length}`);
    if (row.neckline) parts.push(`Neckline: ${row.neckline}`);
    if (row.clothing_style) parts.push(`Style: ${row.clothing_style}`);
  }
  
  // Mug details
  const isMug = (row.category || "") === "Mugs & Drinkware";
  if (isMug) {
    if (row.capacity) parts.push(`Capacity: ${row.capacity}`);
    if (row.dishwasher_safe === "true") parts.push(`Dishwasher Safe`);
    if (row.microwave_safe === "true") parts.push(`Microwave Safe`);
  }
  
  // Art details
  const isArt = (row.category || "") === "Posters & Prints";
  if (isArt) {
    if (row.orientation) parts.push(`Orientation: ${row.orientation}`);
    if (row.framing) parts.push(`Framing: ${row.framing}`);
    if (row.aspect_ratio) parts.push(`Aspect: ${row.aspect_ratio}`);
  }
  
  return parts.join(" | ");
};

const ATTRIBUTE_KEYS = [
  "primary_color", "secondary_color", "materials", "occasion", "celebration",
  "subject", "sleeve_length", "neckline", "clothing_style", "capacity",
  "dishwasher_safe", "microwave_safe", "orientation", "framing", "aspect_ratio",
  "graphic"
] as const;

const parseAttributesSummary = (summaryText: string): Partial<RowData> => {
  const result: Partial<RowData> = {};

  const cleanText = summaryText ? summaryText.replace("⚙️", "").replace("Configure...", "").trim() : "";
  if (!cleanText) {
    // Clear all attributes
    for (const key of ATTRIBUTE_KEYS) {
      result[key] = "";
    }
    result.dishwasher_safe = "false";
    result.microwave_safe = "false";
    return result;
  }

  const parts = cleanText.split("|").map(p => p.trim());
  
  // If the summary is for Mugs, we can default dishwasher/microwave safe to false unless explicitly seen
  const isMugSummary = cleanText.toLowerCase().includes("capacity:");
  if (isMugSummary) {
    result.dishwasher_safe = "false";
    result.microwave_safe = "false";
  }

  for (const part of parts) {
    if (!part) continue;

    const lowerPart = part.toLowerCase();
    if (lowerPart === "dishwasher safe") {
      result.dishwasher_safe = "true";
      continue;
    }
    if (lowerPart === "microwave safe") {
      result.microwave_safe = "true";
      continue;
    }

    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;

    const key = part.substring(0, colonIdx).trim().toLowerCase();
    const val = part.substring(colonIdx + 1).trim();

    if (key === "color") {
      result.primary_color = val;
    } else if (key === "sec color") {
      result.secondary_color = val;
    } else if (key === "materials") {
      result.materials = val;
    } else if (key === "graphic") {
      result.graphic = val;
    } else if (key === "occasion") {
      result.occasion = val;
    } else if (key === "celebration") {
      result.celebration = val;
    } else if (key === "subject") {
      result.subject = val;
    } else if (key === "sleeve") {
      result.sleeve_length = val;
    } else if (key === "neckline") {
      result.neckline = val;
    } else if (key === "style") {
      result.clothing_style = val;
    } else if (key === "capacity") {
      result.capacity = val;
    } else if (key === "orientation") {
      result.orientation = val;
    } else if (key === "framing") {
      result.framing = val;
    } else if (key === "aspect") {
      result.aspect_ratio = val;
    }
  }

  return result;
};

export default function SpreadsheetGrid() {
  const gridRef = useRef<DataEditorRef>(null);
  const [sheet, setSheet] = useState<"digital" | "physical">("digital");
  const [columns, setColumns] = useState(DIGITAL_COLUMNS);
  const [zoom, setZoom] = useState(1);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>(undefined);
  const [globalImageEditor, setGlobalImageEditor] = useState<{row: number, urls: string[], altTexts: string[]} | null>(null);
  const [globalAttributesEditor, setGlobalAttributesEditor] = useState<{ row: number } | null>(null);
  const [globalVariationsEditor, setGlobalVariationsEditor] = useState<{ row: number } | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Task Queue State
  type QueueTask = { id: string; action: string; row: number; sheet: "digital" | "physical" };
  const [taskQueue, setTaskQueue] = useState<QueueTask[]>([]);
  const isProcessingQueue = React.useRef(false);
  const [showUpdateMenu, setShowUpdateMenu] = useState(false);
  const [showGenerateMenu, setShowGenerateMenu] = useState(false);
  const [sections, setSections] = useState<string[]>([""]);
  const [shippingProfiles, setShippingProfiles] = useState<string[]>([""]);
  const [processingProfiles, setProcessingProfiles] = useState<string[]>([""]);

  const fetchSections = useCallback(() => {
     fetch('/api/etsy/sections')
       .then(res => res.json())
       .then(data => {
          if (data.sections && Array.isArray(data.sections)) {
             setSections(["", ...data.sections.map((s: { title: string }) => s.title)]);
          } else {
             setSections(["", "Comfort Colors 1717", "Gilden 5000", "Digital Prints"]);
          }
       })
       .catch(err => {
          console.warn("Failed to load shop sections dynamically:", err);
          setSections(["", "Comfort Colors 1717", "Gilden 5000", "Digital Prints"]);
       });
  }, []);

  const fetchShippingProfiles = useCallback(() => {
     fetch('/api/etsy/shipping-profiles')
       .then(res => res.json())
       .then(data => {
          if (data.profiles && Array.isArray(data.profiles)) {
             setShippingProfiles(["", ...data.profiles.map((p: { title: string }) => p.title)]);
          } else {
             setShippingProfiles(["", "Standard Shipping", "Express Shipping"]);
          }
       })
       .catch(err => {
          console.warn("Failed to load shipping profiles dynamically:", err);
          setShippingProfiles(["", "Standard Shipping", "Express Shipping"]);
       });
  }, []);

  const fetchProcessingProfiles = useCallback(() => {
     fetch('/api/etsy/processing-profiles')
       .then(res => res.json())
       .then(data => {
          if (data.profiles && Array.isArray(data.profiles)) {
             setProcessingProfiles(["", ...data.profiles.map((p: { title: string }) => p.title)]);
          } else {
             setProcessingProfiles([""]);
          }
       })
       .catch(err => {
          console.warn("Failed to load processing profiles dynamically:", err);
          setProcessingProfiles([""]);
       });
  }, []);

  React.useEffect(() => {
     fetchSections();
     fetchShippingProfiles();
     fetchProcessingProfiles();
     
     const handleChanged = () => {
        fetchSections();
        fetchShippingProfiles();
        fetchProcessingProfiles();
     };

     window.addEventListener("etsy-store-changed", handleChanged);
     return () => window.removeEventListener("etsy-store-changed", handleChanged);
  }, [fetchSections, fetchShippingProfiles, fetchProcessingProfiles]);

  React.useEffect(() => {
    document.fonts.ready.then(() => {
      setFontsLoaded(true);
    });
  }, []);

  // Update columns when sheet changes
  React.useEffect(() => {
    setColumns(sheet === "digital" ? DIGITAL_COLUMNS : PHYSICAL_COLUMNS);
  }, [sheet]);

  // Initialize with empty rows (avoids Next.js hydration mismatch)
  const [data, setData] = useState<RowData[]>(() => {
    return Array.from({ length: 50 }).map(() => ({ ...(sheet === "digital" ? emptyRowDigital : emptyRowPhysical) }));
  });

  // Load from local storage AFTER initial render and when sheet changes
  React.useEffect(() => {
    setIsDataLoaded(false);
    const key = sheet === "digital" ? "workstation_v2_grid_data" : "workstation_v2_grid_data_physical";
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setData(parsed);
          dataRef.current = parsed;
        } else {
          const freshData = Array.from({ length: 50 }).map(() => ({ ...(sheet === "digital" ? emptyRowDigital : emptyRowPhysical) }));
          setData(freshData);
          dataRef.current = freshData;
        }
      } catch (e) {
        console.error("Failed to parse local storage grid data", e);
      }
    } else {
      const freshData = Array.from({ length: 50 }).map(() => ({ ...(sheet === "digital" ? emptyRowDigital : emptyRowPhysical) }));
      setData(freshData);
      dataRef.current = freshData;
    }
    setIsDataLoaded(true);
  }, [sheet]);

  const dataRef = React.useRef(data);
  // Keep the ref strictly synchronized with the state
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const sheetRef = React.useRef(sheet);
  React.useEffect(() => { sheetRef.current = sheet; }, [sheet]);
  const { triggerAIGeneration, triggerFolderAutomation } = useAIPipeline(dataRef, setData, sheet, sheetRef);
  const { triggerEtsyPush } = useEtsyPush(dataRef, setData, sheet, sheetRef);

  const processBulkQueue = (action: string, rows: number[]) => {
    rows = rows.filter(row => dataRef.current[row]?.folder || dataRef.current[row]?.title || dataRef.current[row]?.context);
    if (rows.length === 0) return;
    
    // Validation
    for (const row of rows) {
      const rowData = dataRef.current[row];
      if (action.startsWith('update_') && !rowData.listing_id) {
        toast.error(`Row ${row + 1} is missing a Listing ID for updates.`);
        return;
      }
      if (action === 'publish' && (!rowData.title || !rowData.description)) {
         toast.error(`Row ${row + 1} is missing a Title or Description required for publishing.`);
         return;
      }
      if (action === 'update_text' && rowData.tags && (!rowData.title || !rowData.description)) {
         toast.error(`Row ${row + 1} has tags defined. Etsy requires both a Title and Description to update tags.`);
         return;
      }
    }

    setShowUpdateMenu(false);
    setShowGenerateMenu(false);

    const newTasks = rows.map(row => ({
       sheet,
       id: Math.random().toString(36).substring(7),
       action,
       row
    }));
    
    setTaskQueue(prev => [...prev, ...newTasks]);
  };

  React.useEffect(() => {
    if (taskQueue.length === 0) return;
    if (isProcessingQueue.current) return;

    const processNext = async () => {
      isProcessingQueue.current = true;
      const currentTask = taskQueue.find(t => t.sheet === sheet);
      if (!currentTask) { isProcessingQueue.current = false; return; }
      
      try {
        if (currentTask.action === "generate") {
          await triggerAIGeneration(currentTask.row, []);
        } else if (currentTask.action === "generate_title") {
          await triggerAIGeneration(currentTask.row, ["title"]);
        } else if (currentTask.action === "generate_description") {
          await triggerAIGeneration(currentTask.row, ["description"]);
        } else if (currentTask.action === "generate_tags") {
          await triggerAIGeneration(currentTask.row, ["tags"]);
        } else if (currentTask.action === "generate_all") {
          await triggerAIGeneration(currentTask.row, ["title", "description", "tags", "primary_color", "occasion", "celebration", "subject"]);
        } else if (currentTask.action === "publish") {
          await triggerEtsyPush(currentTask.row, "all");
        } else if (currentTask.action === "update_text") {
          await triggerEtsyPush(currentTask.row, "Update Text & SEO");
        } else if (currentTask.action === "update_images") {
          await triggerEtsyPush(currentTask.row, "Update Images Only");
        } else if (currentTask.action === "update_video") {
          await triggerEtsyPush(currentTask.row, "Update Video Only");
        } else if (currentTask.action === "update_files") {
          await triggerEtsyPush(currentTask.row, "Update Digital Files");
        }
      } catch (err) {
         console.error("Queue task failed:", err);
      } finally {
        setTaskQueue(prev => prev.filter(t => t.id !== currentTask.id));
        isProcessingQueue.current = false;
        
        // Delay to avoid hitting API rate limits if there are more tasks
        if (taskQueue.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };

    processNext();
  }, [taskQueue, triggerAIGeneration, triggerEtsyPush, sheet]);

  // Persist to local storage with a 500ms debounce (ONLY after initial load)
  React.useEffect(() => {
    if (!isDataLoaded) return;
    
    const handler = setTimeout(() => {
      const key = sheet === "digital" ? "workstation_v2_grid_data" : "workstation_v2_grid_data_physical";
      localStorage.setItem(key, JSON.stringify(data));
    }, 500);
    return () => clearTimeout(handler);
  }, [data, isDataLoaded, sheet]);

  // Ensure data isn't lost if the tab is closed before the 500ms debounce fires
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      const key = sheet === "digital" ? "workstation_v2_grid_data" : "workstation_v2_grid_data_physical";
      localStorage.setItem(key, JSON.stringify(dataRef.current));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sheet]);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const dataRow = dataRef.current[row];
      const columnId = columns[col].id as keyof typeof dataRow;

      if (!dataRow) {
          return {
              kind: GridCellKind.Text,
              allowOverlay: false,
              displayData: "",
              data: "",
          } as TextCell;
      }

      const isActiveRow = !!dataRow.status || !!dataRow.folder || !!dataRow.title;

      const value = (typeof dataRow[columnId] === "string" ? dataRow[columnId] : "") as string;

      const hasActiveVariations = sheet === "physical" && dataRow.variations && dataRow.variations.properties && dataRow.variations.properties.length > 0;
      const enabledCombs = hasActiveVariations ? (dataRow.variations?.combinations || []).filter((c: any) => c.isEnabled) : [];

      if (columnId === "variations") {
        if (sheet !== "physical") {
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            readonly: true,
            data: "",
            displayData: "N/A",
            themeOverride: { bgCell: "#fafafa" }
          } as TextCell;
        }
        
        if (hasActiveVariations && enabledCombs.length > 0) {
          const prices = enabledCombs.map((c: any) => parseFloat(c.price) || parseFloat(dataRow.price) || 0.0);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceStr = minPrice === maxPrice ? `$${minPrice.toFixed(2)}` : `$${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)}`;
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            readonly: true,
            data: `${enabledCombs.length} variants`,
            displayData: `⚙️ ${enabledCombs.length} Variants (${priceStr})`,
            themeOverride: {
              baseFontStyle: "bold 12px Inter, sans-serif",
              textDark: "#2b52d6",
              bgCell: "#f0f4ff"
            }
          } as TextCell;
        } else {
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            readonly: true,
            data: "Configure",
            displayData: "⚙️ Configure...",
            themeOverride: {
              textDark: "#64748b",
              bgCell: "#f8fafc"
            }
          } as TextCell;
        }
      }

      // Special rendering for Price column under variations
      if (columnId === "price") {
         if (hasActiveVariations && enabledCombs.length > 0) {
            const prices = enabledCombs.map((c: any) => parseFloat(c.price) || parseFloat(dataRow.price) || 0.0);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const priceStr = minPrice === maxPrice ? `$${minPrice.toFixed(2)}` : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
            return {
              kind: GridCellKind.Text,
              allowOverlay: true,
              data: minPrice === maxPrice ? String(minPrice) : "varies",
              displayData: priceStr,
              themeOverride: {
                bgCell: "#f8fafc",
                textDark: "#334155"
              }
            } as TextCell;
         }
      }

      // Special rendering for Quantity column under variations
      if (columnId === "quantity") {
         if (hasActiveVariations && enabledCombs.length > 0) {
            const totalQty = enabledCombs.reduce((sum: number, c: any) => sum + (parseInt(c.quantity) || parseInt(dataRow.quantity) || 0), 0);
            return {
              kind: GridCellKind.Text,
              allowOverlay: true,
              data: String(totalQty),
              displayData: String(totalQty),
              themeOverride: {
                bgCell: "#f8fafc",
                textDark: "#334155"
              }
            } as TextCell;
         }
      }

      if (columnId === "images") {
        const urlArray = value ? value.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
        const cacheKey = urlArray.join(",");
        
        if (!imageCache[cacheKey]) {
           // LRU-lite limit to prevent memory leak
           const keys = Object.keys(imageCache);
           if (keys.length > 200) delete imageCache[keys[0]];

           const absoluteUrlArray = urlArray.map((url: string) => 
             url.startsWith('http') || url.startsWith('data:') 
               ? url 
               : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
           );

           const thumbnailUrls = absoluteUrlArray.map((url: string) => {
             if (url.startsWith(window.location.origin)) {
               const relative = url.substring(window.location.origin.length);
               return `${window.location.origin}/_next/image?url=${encodeURIComponent(relative)}&w=256&q=75`;
             }
             return url;
           });
           
           imageCache[cacheKey] = { absoluteUrlArray, thumbnailUrls };
        }
        
        const { absoluteUrlArray, thumbnailUrls } = imageCache[cacheKey];

        return {
          kind: GridCellKind.Image,
          allowOverlay: true,
          allowAdd: true, 
          data: absoluteUrlArray,
          displayData: thumbnailUrls,
        } as GridCell;
      }

      // Clean visual structure for Video and Digital File columns
      if (columnId === "video" || columnId === "digital_file") {
        if (!value) {
           return {
             kind: GridCellKind.Text,
             allowOverlay: false,
             readonly: true,
             data: "",
             displayData: ""
           } as TextCell;
        }

        const cacheKey = `tags_${value}`;
        if (!tagCache[cacheKey]) {
           const keys = Object.keys(tagCache);
           if (keys.length > 200) delete tagCache[keys[0]];

           const files = value.split(',').map((s: string) => s.trim()).filter(Boolean);
           const tags = files.map((file: string) => {
             const ext = file.split('.').pop()?.toLowerCase();
             if (['mp4', 'mov', 'avi'].includes(ext || '')) return 'VIDEO';
             if (['png', 'jpg', 'jpeg'].includes(ext || '')) return 'IMAGE';
             if (ext === 'pdf') return 'PDF';
             if (['zip', 'rar'].includes(ext || '')) return 'ZIP';
             if (['wav', 'mp3'].includes(ext || '')) return 'AUDIO';
             return 'FILE';
           });
           tagCache[cacheKey] = tags;
        }
        const tags = tagCache[cacheKey];

        return {
          kind: GridCellKind.Bubble,
          allowOverlay: false,
          data: tags,
          themeOverride: {
            bgBubble: "#2b52d6",
            textBubble: "#ffffff",
            bgBubbleSelected: "#2b52d6",
            textBubbleSelected: "#ffffff",
            roundingRadius: 0
          }
        } as GridCell;
      }

      // Visual State Machine for the AI Pipeline
      if (columnId === "status") {
         // Don't show status pills on completely blank rows
         if (!value && !dataRow.folder && !dataRow.context) {
             return { kind: GridCellKind.Text, data: "", allowOverlay: true, displayData: "" } as GridCell;
         }

         const state = value || "Draft";
         const isLoading = state === "Generating..." || state === "Pushing...";

         if (isLoading) {
            const textColor = "#b45309"; // amber-700
            return {
               kind: GridCellKind.Text,
               allowOverlay: false,
               readonly: true,
               data: state,
               displayData: `⏳ ${state}`,
               themeOverride: {
                  textDark: textColor,
                  textLight: textColor,
                  baseFontStyle: "bold 12px Inter, sans-serif",
                  bgCell: "#fef3c7" // amber shading
               }
            } as GridCell;
         }

         let textColor = "#4b5563"; // gray-600
         let bgCell = "#f3f4f6"; // gray-100
         if (state === "Review") {
            textColor = "#047857"; // emerald-700
            bgCell = "#ecfdf5"; // emerald-50
         } else if (state === "Published") {
            textColor = "#15803d"; // green-700
            bgCell = "#dcfce7"; // green-50
         } else if (state === "Error") {
            textColor = "#b91c1c"; // red-700
            bgCell = "#fee2e2"; // red-50
         }

         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: state,
            data: {
               kind: "dropdown-cell",
               allowedValues: ETSY_STATUSES,
               value: state
            },
            themeOverride: { 
              textDark: textColor,
              textLight: textColor,
              baseFontStyle: "bold 12px Inter, sans-serif",
              bgCell: bgCell
            }
         } as GridCell;
      }

      if (columnId === "category") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: sheet === "digital" ? ETSY_DIGITAL_CATEGORIES : ETSY_PHYSICAL_CATEGORIES,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "shipping_profile") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: shippingProfiles,
               value: value || ""
            },
            themeOverride: {
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "readiness_state_id") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: processingProfiles,
               value: value || ""
            },
            themeOverride: {
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "subject") {
         const supported = !isActiveRow || categorySupportsSubject(dataRow.category || "");
         if (!supported) return { kind: GridCellKind.Text, allowOverlay: false, readonly: true, data: "", displayData: "N/A", themeOverride: { bgCell: "#fafafa" } } as TextCell;
         
         if (sheet === "digital") {
            return {
               kind: GridCellKind.Custom,
               allowOverlay: true,
               copyData: value,
               data: {
                  kind: "dropdown-cell",
                  allowedValues: ETSY_SUBJECTS,
                  value: value || ""
               },
               themeOverride: { 
                 baseFontStyle: "13px Inter, sans-serif"
               }
            } as GridCell;
         } else {
            return {
               kind: GridCellKind.Text,
               allowOverlay: false,
               readonly: true,
               data: value,
               displayData: value || "Select subjects...",
               themeOverride: {
                  baseFontStyle: "13px Inter, sans-serif"
               }
            } as TextCell;
         }
      }

      if (columnId === "graphic") {
         const supported = !isActiveRow || categorySupportsGraphic(dataRow.category || "");
         if (!supported) return { kind: GridCellKind.Text, allowOverlay: false, readonly: true, data: "", displayData: "N/A", themeOverride: { bgCell: "#fafafa" } } as TextCell;
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ETSY_GRAPHICS,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "section") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: sections,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "primary_color") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ETSY_COLORS,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "secondary_color") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ETSY_COLORS,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "occasion") {
         const supported = !isActiveRow || categorySupportsOccasion(dataRow.category || "");
         if (!supported) return { kind: GridCellKind.Text, allowOverlay: false, readonly: true, data: "", displayData: "", themeOverride: { bgCell: "#fafafa" } } as TextCell;
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ETSY_OCCASIONS,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "celebration") {
         const supported = !isActiveRow || categorySupportsCelebration(dataRow.category || "");
         if (!supported) return { kind: GridCellKind.Text, allowOverlay: false, readonly: true, data: "", displayData: "", themeOverride: { bgCell: "#fafafa" } } as TextCell;
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ETSY_CELEBRATIONS,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "attributes") {
        const summary = getAttributesSummary(dataRow);
        if (summary) {
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            readonly: true,
            data: summary,
            displayData: summary,
          } as TextCell;
        } else {
          return {
            kind: GridCellKind.Text,
            allowOverlay: false,
            readonly: true,
            data: "",
            displayData: "⚙️ Configure...",
            themeOverride: {
              textDark: "#64748b",
              bgCell: "#f8fafc"
            }
          } as TextCell;
        }
      }

      return {
        kind: GridCellKind.Text,
        allowOverlay: true,
        data: value,
        displayData: value,
      } as TextCell;
    },
    [columns, sections, sheet, shippingProfiles, processingProfiles]
  );

  const getCellsForSelection = useCallback(
    (selection: Rectangle) => {
      const result: GridCell[][] = [];
      const { x, y, width, height } = selection;
      for (let r = 0; r < height; r++) {
        const row: GridCell[] = [];
        for (let c = 0; c < width; c++) {
          row.push(getCellContent([x + c, y + r]));
        }
        result.push(row);
      }
      return result;
    },
    [getCellContent]
  );


  const onCellEdited = useCallback(
    (cell: Item, newValue: GridCell) => {
      if (newValue.kind !== GridCellKind.Text && newValue.kind !== GridCellKind.Image && newValue.kind !== GridCellKind.Bubble && newValue.kind !== GridCellKind.Custom) return;

      const [col, row] = cell;
      const columnId = columns[col].id as keyof RowData;

      const dataRow = dataRef.current[row];
      const hasActiveVariations = sheet === "physical" && dataRow && dataRow.variations && dataRow.variations.properties && dataRow.variations.properties.length > 0;

      if (columnId === "price" && hasActiveVariations) {
         let val = "";
         if (newValue.kind === GridCellKind.Text) val = newValue.data;
         
         if (val && !isNaN(parseFloat(val))) {
            const confirmed = window.confirm(`This listing uses variations. Do you want to set the price for ALL enabled variants to $${parseFloat(val).toFixed(2)}?`);
            if (confirmed) {
               setData(prev => {
                  const copy = [...prev];
                  const rData = { ...copy[row] };
                  if (rData.variations) {
                     rData.variations = {
                        ...rData.variations,
                        combinations: rData.variations.combinations.map(c => ({ ...c, price: val }))
                     };
                  }
                  rData.price = val;
                  copy[row] = rData;
                  return copy;
               });
               return;
            }
         }
      }
      
      if (columnId === "quantity" && hasActiveVariations) {
         let val = "";
         if (newValue.kind === GridCellKind.Text) val = newValue.data;
         
         if (val && !isNaN(parseInt(val))) {
            const confirmed = window.confirm(`This listing uses variations. Do you want to set the quantity for ALL enabled variants to ${parseInt(val)}?`);
            if (confirmed) {
               setData(prev => {
                  const copy = [...prev];
                  const rData = { ...copy[row] };
                  if (rData.variations) {
                     rData.variations = {
                        ...rData.variations,
                        combinations: rData.variations.combinations.map(c => ({ ...c, quantity: val }))
                     };
                  }
                  rData.quantity = val;
                  copy[row] = rData;
                  return copy;
               });
               return;
            }
         }
      }

      let newStringValue = "";
      if (newValue.kind === GridCellKind.Text) {
        newStringValue = newValue.data;
      } else if (newValue.kind === GridCellKind.Image) {
        // We receive the reordered array from our custom editor
        newStringValue = newValue.data.map(url => {
           // Strip the origin back off so it stores cleanly in the DB as relative
           const origin = window.location.origin;
           return url.startsWith(origin) ? url.substring(origin.length) : url;
        }).join(",");
      } else if (newValue.kind === GridCellKind.Bubble) {
        if (columnId === "status" && newValue.data.length > 0) {
           newStringValue = newValue.data[0];
        } else {
           return;
        }
      } else if (newValue.kind === GridCellKind.Custom) {
        const customColumns = ["status", "category", "section", "primary_color", "secondary_color", "occasion", "celebration", "subject", "graphic", "shipping_profile", "readiness_state_id"];
        if (customColumns.includes(columnId)) {
           newStringValue = (newValue.data as { value: string }).value;
        } else {
           return;
        }
      }

      // Mutate the ref immediately for any synchronous callbacks (like the status fetch below)
      const newDataArray = [...dataRef.current];
      
      // Expand grid if editing outside current bounds
      while (row >= newDataArray.length) {
        newDataArray.push({ ...(sheet === "digital" ? emptyRowDigital : emptyRowPhysical) });
      }

      newDataArray[row] = {
        ...newDataArray[row],
        [columnId]: newStringValue,
      };
      dataRef.current = newDataArray;
      setData(newDataArray);



    },
    [columns, sheet, setData]
  );

  const onCellActivated = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      const columnId = columns[col].id;
      if (columnId === "attributes" && sheet === "physical") {
        const dataRow = dataRef.current[row];
        if (dataRow) {
          setGlobalAttributesEditor({ row });
        }
      } else if (columnId === "variations" && sheet === "physical") {
        const dataRow = dataRef.current[row];
        if (dataRow) {
          setGlobalVariationsEditor({ row });
        }
      }
    },
    [columns, sheet]
  );

  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    setColumns((prev) => {
      const index = prev.findIndex((c) => c.id === column.id);
      if (index === -1) return prev;
      const newCols = [...prev];
      newCols[index] = { ...newCols[index], width: newSize };
      return newCols;
    });
  }, []);

  const onColumnMoved = useCallback((startIndex: number, endIndex: number) => {
    setColumns((prev) => {
      const newCols = [...prev];
      const [movedColumn] = newCols.splice(startIndex, 1);
      newCols.splice(endIndex, 0, movedColumn);
      return newCols;
    });
  }, []);

  const onPaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      const [col, row] = target;
      setData((prev) => {
        const newData = [...prev];
        for (let r = 0; r < values.length; r++) {
          while (row + r >= newData.length) {
            newData.push({ ...(sheet === "digital" ? emptyRowDigital : emptyRowPhysical) });
          }
          const dataRow = { ...newData[row + r] };
          for (let c = 0; c < values[r].length; c++) {
            if (col + c >= columns.length) break;
            const columnId = columns[col + c].id;
            if (!columnId) continue;
            
            const pastedValue = values[r][c];
            if (columnId === "shipping_profile" && pastedValue && !shippingProfiles.includes(pastedValue)) {
               continue;
            }
            if (columnId === "readiness_state_id" && pastedValue && !processingProfiles.includes(pastedValue)) {
               continue;
            }
            
            if (columnId === "attributes") {
              const parsed = parseAttributesSummary(pastedValue);
              Object.assign(dataRow, parsed);
            } else {
              // @ts-expect-error - external type mismatch
              dataRow[columnId] = pastedValue;
            }
          }
          newData[row + r] = dataRow as RowData;
        }
        dataRef.current = newData;
        return newData;
      });

      // If pasting exactly one folder name, trigger the automation
      if (values.length === 1 && values[0].length === 1 && columns[col]?.id === "folder") {
         const pastedValue = values[0][0];
         if (pastedValue) {
            triggerFolderAutomation(row, pastedValue);
         }
      }

      return true;
    },
    [columns, triggerFolderAutomation, sheet, sections, shippingProfiles, processingProfiles]
  );

  const onFillPattern = useCallback(
    (event: { patternSource: { x: number, y: number, width: number, height: number }, fillDestination: { x: number, y: number, width: number, height: number } }) => {
      const { patternSource, fillDestination } = event;
      if (!patternSource || !fillDestination) return;

      setData((prev) => {
        const newData = [...prev];
        const sourceWidth = patternSource.width;
        const sourceHeight = patternSource.height;

        for (let y = 0; y < fillDestination.height; y++) {
          const destRowIndex = fillDestination.y + y;
          while (destRowIndex >= newData.length) {
            newData.push({ ...(sheet === "digital" ? emptyRowDigital : emptyRowPhysical) });
          }

          const sourceRowIndex = patternSource.y + (y % sourceHeight);
          const sourceRowData = newData[sourceRowIndex];
          const destRowData = { ...newData[destRowIndex] };

          for (let x = 0; x < fillDestination.width; x++) {
            const destColIndex = fillDestination.x + x;
            if (destColIndex >= columns.length) break;

            const sourceColIndex = patternSource.x + (x % sourceWidth);
            const sourceColumnId = columns[sourceColIndex].id;
            const destColumnId = columns[destColIndex].id;

            if (!sourceColumnId || !destColumnId) continue;

            if (destColumnId === "attributes") {
              for (const key of ATTRIBUTE_KEYS) {
                destRowData[key] = sourceRowData[key] || "";
              }
            } else {
              // @ts-expect-error - external type mismatch
              destRowData[destColumnId] = sourceRowData[sourceColumnId];
            }
          }

          newData[destRowIndex] = destRowData as RowData;
        }

        dataRef.current = newData;
        return newData;
      });
      return event;
    },
    [columns]
  );

  const onDelete = useCallback(
    (selection: GridSelection) => {
      let didDelete = false;
      const cellsToUpdate: { cell: Item }[] = [];

      setData((prev) => {
        const newData = [...prev];

        // 1. Delete all selected regions
        if (selection.current) {
          const ranges = selection.current.rangeStack && selection.current.rangeStack.length > 0
            ? selection.current.rangeStack
            : (selection.current.range ? [selection.current.range] : []);
            
          for (const rect of ranges) {
            const { x, y, width, height } = rect;
            for (let r = 0; r < height; r++) {
              const rowIdx = y + r;
              if (rowIdx >= newData.length) continue;
              const rowData = { ...newData[rowIdx] };
              for (let c = 0; c < width; c++) {
                const colIdx = x + c;
                if (colIdx >= columns.length) continue;
                const colId = columns[colIdx].id;
                if (colId) {
                  // @ts-expect-error - external type mismatch
                  rowData[colId] = "";
                  didDelete = true;
                  cellsToUpdate.push({ cell: [colIdx, rowIdx] });
                }
              }
              newData[rowIdx] = rowData as RowData;
            }
          }
        }

        // 2. Delete full rows (splice them out entirely)
        if (selection.rows) {
          const selectedRows = typeof selection.rows.toArray === "function" ? selection.rows.toArray() : Array.from(selection.rows);
          
          // Sort indices descending so we can splice safely from bottom up without shifting indices
          const sortedRows = [...selectedRows].sort((a, b) => b - a);
          
          for (const r of sortedRows) {
            if (typeof r !== "number" || r >= newData.length) continue;
            newData.splice(r, 1);
            didDelete = true;
          }
        }

        // 3. Delete full columns
        if (selection.columns) {
          const selectedCols = typeof selection.columns.toArray === "function" ? selection.columns.toArray() : Array.from(selection.columns);
          for (let r = 0; r < newData.length; r++) {
            const rowData = { ...newData[r] };
            for (const c of selectedCols) {
              if (typeof c !== "number" || c >= columns.length) continue;
              const colId = columns[c].id;
              if (colId) {
                // @ts-expect-error - external type mismatch
                rowData[colId] = "";
                didDelete = true;
                cellsToUpdate.push({ cell: [c, r] });
              }
            }
            newData[r] = rowData as RowData;
          }
        }

        dataRef.current = didDelete ? newData : prev;
        return didDelete ? newData : prev;
      });

      if (didDelete && gridRef.current) {
        gridRef.current.updateCells(cellsToUpdate);
      }
      return true;
    },
    [columns]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setZoom((prev) => {
        const newZoom = prev - e.deltaY * 0.005;
        return Math.min(Math.max(newZoom, 0.5), 3);
      });
    }
  }, []);

  // Sync zoom changes manually at the document level to prevent native page zoom
  React.useEffect(() => {
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((prev) => {
          const newZoom = prev - e.deltaY * 0.005;
          return Math.min(Math.max(newZoom, 0.5), 3);
        });
      }
    };
    
    document.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleNativeWheel);
  }, []);

  const selectedRowsList = React.useMemo(() => {
    if (!gridSelection || !gridSelection.rows) return [];
    return typeof gridSelection.rows.toArray === "function" 
      ? gridSelection.rows.toArray() 
      : Array.from(gridSelection.rows);
  }, [gridSelection]);

  return (
    <div className="w-full h-full p-4 bg-white dark:bg-zinc-950 flex flex-col" onWheel={onWheel}>
      <div className="flex-none mb-4 flex items-center justify-between border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-2 px-4 rounded-none">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Spreadsheet Database</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPresets(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-zinc-700 transition-colors rounded-none"
          >
            <Layers size={14} />
            Presets
          </button>
          <button 
            onClick={() => setIsImporterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded-none"
          >
            <FolderPlus size={14} />
            Import
          </button>
        </div>
      </div>
      <div className="flex-1 w-full border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden relative flex flex-col">
        {fontsLoaded && (
          <DataEditor
            ref={gridRef}
            gridSelection={gridSelection}
            onGridSelectionChange={setGridSelection}
            theme={{
              bgHeader: "#f8fafc",
              bgHeaderHovered: "#f1f5f9",
              bgHeaderHasFocus: "#f1f5f9",
              textHeader: "#0f172a",
              bgCell: "#ffffff",
              bgCellMedium: "#f8fafc",
              textDark: "#0f172a",
              textLight: "#64748b",
              baseIconLight: "#94a3b8",
              accentColor: "#2b52d6",
              accentLight: "rgba(43, 82, 214, 0.1)",
              borderColor: "#e2e8f0",
              horizontalBorderColor: "#e2e8f0",
              headerBottomBorderColor: "#e2e8f0",
              roundingRadius: 0,
              headerFontStyle: "600 13px Inter, sans-serif",
              baseFontStyle: "13px Inter, sans-serif",
            } as Partial<Theme>}
            rowMarkers="both"
            getCellContent={getCellContent}
            columns={columns}
            rows={data.length + 1}
            rowHeight={Math.floor(Math.max(34 * zoom, 20))}
            headerHeight={Math.floor(Math.max(36 * zoom, 24))}
            fillHandle={true}
            rangeSelect="rect"
            columnSelect="multi"
            getCellsForSelection={getCellsForSelection}
            onFillPattern={onFillPattern}
            onDelete={onDelete}
            onCellEdited={onCellEdited}
            onCellActivated={onCellActivated}
            customRenderers={allCells}
            onColumnResize={onColumnResize}
            onColumnMoved={onColumnMoved}
            onPaste={onPaste}
            imageEditorOverride={(p) => {
               if (!p.urls || p.urls.length === 0) {
                   setTimeout(() => p.onCancel(), 0);
                   return null;
               }
               setTimeout(() => {
                  if (gridSelection?.current?.cell) {
                     const [, row] = gridSelection.current.cell;
                     const altTexts = dataRef.current[row].alt_text ? dataRef.current[row].alt_text.split('|').map((s:string) => s.trim()) : [];
                     setGlobalImageEditor({ row, urls: p.urls as string[], altTexts });
                  }
                  p.onCancel(); 
               }, 0);
               return null;
            }}
          />
        )}
      </div>
      {/* Bottom Sheet Tabs Bar */}
      <div className="flex-none h-10 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between px-3 select-none">
        <div className="flex items-start gap-1 h-full -mt-[1px]">
          <button
            onClick={() => setSheet("digital")}
            className={`px-4 h-[28px] text-[11px] font-semibold uppercase tracking-wider transition-all border flex items-center rounded-none cursor-pointer ${
              sheet === "digital"
                ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 border-zinc-200 dark:border-zinc-800 border-t-white dark:border-t-zinc-950 border-b-2 border-b-blue-600 dark:border-b-blue-500 z-10 font-bold"
                : "bg-zinc-100/50 dark:bg-zinc-900/30 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-transparent border-t border-t-zinc-200 dark:border-t-zinc-800"
            }`}
          >
            Digital Worksheet
          </button>
          <button
            onClick={() => setSheet("physical")}
            className={`px-4 h-[28px] text-[11px] font-semibold uppercase tracking-wider transition-all border flex items-center rounded-none cursor-pointer ${
              sheet === "physical"
                ? "bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 border-zinc-200 dark:border-zinc-800 border-t-white dark:border-t-zinc-950 border-b-2 border-b-blue-600 dark:border-b-blue-500 z-10 font-bold"
                : "bg-zinc-100/50 dark:bg-zinc-900/30 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-transparent border-t border-t-zinc-200 dark:border-t-zinc-800"
            }`}
          >
            Physical Worksheet
          </button>
        </div>
      </div>

      {/* Render the independent Custom Image Editor completely outside the grid */}
      {globalImageEditor && (
        <CustomImageEditor 
          urls={globalImageEditor.urls}
          altTexts={globalImageEditor.altTexts} 
          onCancel={() => setGlobalImageEditor(null)}
          onChange={(newUrls, newAlts) => {
            setData((prev) => {
              const newData = [...prev];
              newData[globalImageEditor.row] = {
                 ...newData[globalImageEditor.row],
                 images: newUrls.map(url => url.startsWith(window.location.origin) ? url.substring(window.location.origin.length) : url).join(","),
                 alt_text: newAlts.join(" | ")
              };
              dataRef.current = newData;
              return newData;
            });
            setGlobalImageEditor(null);
          }}
        />
      )}

      {/* Render the independent Attributes Drawer completely outside the grid */}
      {globalAttributesEditor !== null && (
        <AttributesDrawer 
          row={globalAttributesEditor.row}
          rowData={data[globalAttributesEditor.row]}
          onClose={() => setGlobalAttributesEditor(null)}
          setData={setData}
        />
      )}



      {/* Folder Importer Modal */}
      {isImporterOpen && (
        <FolderImporterModal 
          sheetType={sheet}
          onClose={() => setIsImporterOpen(false)}
          onImport={(selectedFolders, preset) => {
            const newRows = selectedFolders.map(folderName => {
              const row: RowData = { ...(sheet === "digital" ? emptyRowDigital : emptyRowPhysical), folder: folderName };
              if (preset) {
                row.category = preset.category || (sheet === "digital" ? "Store Graphics" : "");
                row.section = preset.section || "";
                row.price = preset.price || "";
                row.quantity = preset.quantity || "";
                row.context = preset.context || "";
                row.occasion = preset.occasion || "";
                row.celebration = preset.celebration || "";
                row.subject = preset.subject || "";
                row.who_made = preset.who_made || "i_did";
                row.when_made = preset.when_made || "2020_2026";
                row.is_supply = preset.is_supply || "false";
                row.renewal_options = preset.renewal_options || "automatic";
                row.ai_title_rules = preset.ai_title_rules || "";
                row.ai_desc_rules = preset.ai_desc_rules || "";
                row.ai_tag_rules = preset.ai_tag_rules || "";
                row.shipping_profile = preset.shipping_profile || "";
                row.readiness_state_id = preset.readiness_state_id || "";
                row.materials = preset.materials || "";
                row.sleeve_length = preset.sleeve_length || "";
                row.neckline = preset.neckline || "";
                row.clothing_style = preset.clothing_style || "";
                row.capacity = preset.capacity || "";
                row.dishwasher_safe = preset.dishwasher_safe || "";
                row.microwave_safe = preset.microwave_safe || "";
                row.orientation = preset.orientation || "";
                row.framing = preset.framing || "";
                row.aspect_ratio = preset.aspect_ratio || "";
                row.graphic = preset.graphic || "";
                row.variations = preset.variations;
              }
              return row;
            });

            const rowsToAutomate: { rowIndex: number, folderName: string }[] = [];

            setData(prev => {
              const newData = [...prev];
              let insertedCount = 0;
              
              for (let i = 0; i < newData.length && insertedCount < newRows.length; i++) {
                const row = newData[i];
                if (!row.folder && !row.title && !row.status) {
                  newData[i] = newRows[insertedCount];
                  rowsToAutomate.push({ rowIndex: i, folderName: newRows[insertedCount].folder || "" });
                  insertedCount++;
                }
              }
              
              while (insertedCount < newRows.length) {
                const rowIndex = newData.length;
                newData.push(newRows[insertedCount]);
                rowsToAutomate.push({ rowIndex, folderName: newRows[insertedCount].folder || "" });
                insertedCount++;
              }
              
              dataRef.current = newData;
              return newData;
            });
            setIsImporterOpen(false);

            setTimeout(() => {
              rowsToAutomate.forEach(({ rowIndex, folderName }) => {
                triggerFolderAutomation(rowIndex, folderName);
              });
            }, 0);
          }}
        />
      )}

      {/* Bulk Action Toolbar */}
      {(showGenerateMenu || showUpdateMenu) && (
        <div className="fixed inset-0 z-[998]" onClick={() => { setShowGenerateMenu(false); setShowUpdateMenu(false); }} />
      )}
      {selectedRowsList.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#2b52d6] text-white shadow-2xl flex items-center p-1.5 px-3 z-[999] animate-in slide-in-from-bottom-10 fade-in duration-300 gap-1.5">
          <span className="text-sm font-medium px-3 border-r border-blue-500 mr-1">
            {selectedRowsList.length} Selected
          </span>
          <div className="relative flex items-center">
            <button onClick={() => { setShowGenerateMenu(!showGenerateMenu); setShowUpdateMenu(false); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors">
              {selectedRowsList.length > 1 ? "Bulk Generate" : "Generate"} 
              <ChevronDown size={14} className={`transition-transform ${showGenerateMenu ? 'rotate-180' : ''}`} />
            </button>
            {showGenerateMenu && (
              <div className="absolute bottom-full left-0 mb-3 bg-[#2b52d6] border border-blue-500 shadow-xl flex flex-col p-1 min-w-[200px] animate-in slide-in-from-bottom-2 fade-in duration-200">
                <span className="text-xs font-bold text-blue-200 px-3 py-1.5 uppercase tracking-wider">Generate Options</span>
                <button onClick={() => processBulkQueue('generate', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Fill Missing Fields</button>
                <div className="h-px bg-blue-500 my-1 mx-2"></div>
                <button onClick={() => processBulkQueue('generate_title', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Regenerate Title</button>
                <button onClick={() => processBulkQueue('generate_description', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Regenerate Description</button>
                <button onClick={() => processBulkQueue('generate_tags', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Regenerate Tags</button>
                <div className="h-px bg-blue-500 my-1 mx-2"></div>
                <button onClick={() => processBulkQueue('generate_all', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors font-semibold">Regenerate All Fields</button>
              </div>
            )}
          </div>
          
          {selectedRowsList.every(r => data[r]?.listing_id) ? (
            <div className="relative flex items-center">
              <button onClick={() => { setShowUpdateMenu(!showUpdateMenu); setShowGenerateMenu(false); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors">
                {selectedRowsList.length > 1 ? "Bulk Update" : "Update"}
                <ChevronDown size={14} className={`transition-transform ${showUpdateMenu ? 'rotate-180' : ''}`} />
              </button>
              {showUpdateMenu && (
                <div className="absolute bottom-full left-0 mb-3 bg-[#2b52d6] border border-blue-500 shadow-xl flex flex-col p-1 min-w-[200px] animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <span className="text-xs font-bold text-blue-200 px-3 py-1.5 uppercase tracking-wider">Update Options</span>
                  <button onClick={() => processBulkQueue('update_text', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Text & SEO</button>
                  <button onClick={() => processBulkQueue('update_images', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Images Only</button>
                  <button onClick={() => processBulkQueue('update_video', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Video Only</button>
                  <button onClick={() => processBulkQueue('update_files', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Digital Files</button>
                  <div className="h-px bg-blue-500 my-1 mx-2"></div>
                  <button onClick={() => processBulkQueue('publish', selectedRowsList)} className="text-left px-3 py-2 text-sm text-white hover:bg-red-600 transition-colors font-semibold">Force Full Overwrite</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => processBulkQueue('publish', selectedRowsList)} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-sm">
              {selectedRowsList.length > 1 ? "Bulk Publish" : "Publish"}
            </button>
          )}

          <div className="w-px h-5 bg-blue-500 mx-1"></div>
          
          <button onClick={() => {
             const fakeSelection = { rows: { toArray: () => selectedRowsList } };
             // @ts-expect-error - bypassing generic type
             onDelete(fakeSelection);
             setGridSelection(undefined);
          }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-red-600 transition-colors" title="Delete Selected Rows">
            Delete <Trash2 size={14} />
          </button>
          <button onClick={() => setGridSelection(undefined)} className="flex items-center justify-center w-8 h-8 hover:bg-blue-700 transition-colors ml-1">
            ✕
          </button>
        </div>
      )}

      {/* Task Queue Status */}
      {taskQueue.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-[#2b52d6] border border-blue-500 text-white shadow-2xl flex items-center p-3 px-5 z-[999] animate-in slide-in-from-bottom-10 fade-in duration-300 gap-4 min-w-[300px]">
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-blue-200 uppercase tracking-wider">
              <span>
                {taskQueue[0].action.includes('generate') ? 'Generating AI...' : 
                 taskQueue[0].action.includes('publish') ? 'Publishing to Etsy...' : 'Updating Listings...'}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">{taskQueue.length} remaining</span>
                <button 
                  onClick={() => setTaskQueue([])}
                  className="text-blue-300 hover:text-red-400 transition-colors"
                  title="Cancel remaining tasks"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="w-full bg-blue-900 h-1.5 overflow-hidden relative">
              <div 
                className="bg-white h-full absolute top-0 left-0 transition-all duration-1000 ease-linear animate-pulse" 
                style={{ width: '100%' }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Variations Editor Side Drawer */}
      {globalVariationsEditor !== null && (
         <VariationsDrawer 
            row={globalVariationsEditor.row} 
            onClose={() => setGlobalVariationsEditor(null)} 
            rowData={data[globalVariationsEditor.row]}
            setData={setData}
         />
      )}

      {/* Preset Manager Modal */}
      {showPresets && <PresetManagerModal onClose={() => setShowPresets(false)} sheetType={sheet} />}
    </div>
  );
}

// Custom Image Editor Overlay
function CustomImageEditor({ urls, altTexts, onCancel, onChange }: { urls: readonly string[], altTexts: readonly string[], onCancel: () => void, onChange: (urls: string[], alts: string[]) => void }) {
  const [items, setItems] = useState(() => urls.map((url, i) => ({ url, alt: altTexts[i] || "" })));
  const dragItem = React.useRef<number | null>(null);
  const dragOverItem = React.useRef<number | null>(null);

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _items = [...items];
    const draggedContent = _items.splice(dragItem.current, 1)[0];
    _items.splice(dragOverItem.current, 0, draggedContent);
    setItems(_items);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAltChange = (index: number, newAlt: string) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], alt: newAlt };
      return copy;
    });
  };

  if (typeof document === 'undefined') return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/10 backdrop-blur-[2px]" 
      onPointerDown={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white ring-2 ring-[#2b52d6] p-4 w-[85vw] max-w-5xl min-h-[300px] relative flex flex-col rounded-none shadow-2xl animate-in fade-in zoom-in-95 duration-100">
        
        <div className="flex-1 flex items-start gap-4 overflow-x-auto custom-scrollbar pt-2 pb-4 mt-2 px-1">
          {items.map((item, i) => (
            <div 
              key={item.url + i} 
              draggable
              onDragStart={() => { dragItem.current = i; }}
              onDragEnter={() => { dragOverItem.current = i; }}
              onDragEnd={handleSort}
              onDragOver={(e) => e.preventDefault()}
              className="relative group shrink-0 bg-zinc-50 border border-gray-200 p-2 flex flex-col items-center cursor-grab active:cursor-grabbing hover:border-[#2b52d6] hover:shadow-md transition-all duration-200"
            >
              <button 
                onClick={() => removeItem(i)} 
                className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm text-gray-500 hover:text-red-600 hover:bg-white w-6 h-6 rounded-none flex items-center justify-center text-xs font-bold z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm"
              >
                ✕
              </button>
              <span className="absolute top-1 left-1 bg-[#2b52d6]/90 backdrop-blur-sm text-white w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold z-10 shadow-sm">
                {i + 1}
              </span>
              <Image src={item.url} unoptimized alt={`Preview ${i}`} width={180} height={180} className="object-contain pointer-events-none bg-white border border-gray-100 mb-2" />
              <input 
                type="text"
                placeholder="Alt Text (SEO)..."
                value={item.alt}
                onChange={(e) => handleAltChange(i, e.target.value)}
                onPointerDown={(e) => e.stopPropagation()} 
                className="w-full text-xs p-1.5 border border-gray-200 rounded-none focus:outline-none focus:border-[#2b52d6] focus:ring-1 focus:ring-[#2b52d6] placeholder-gray-400"
              />
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50/50 mt-2">
          <button 
            onClick={onCancel}
            className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 transition-colors rounded-none"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onChange(items.map(img => img.url), items.map(img => img.alt));
            }}
            className="px-8 py-2 text-sm font-medium text-white bg-[#2b52d6] hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm rounded-none"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
}

interface AttributesDrawerProps {
  row: number;
  rowData: RowData;
  onClose: () => void;
  setData: React.Dispatch<React.SetStateAction<RowData[]>>;
}

function AttributesDrawer({ row, rowData, onClose, setData }: AttributesDrawerProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [formData, setFormData] = useState({
    primary_color: rowData.primary_color || "",
    secondary_color: rowData.secondary_color || "",
    materials: rowData.materials || "",
    occasion: rowData.occasion || "",
    celebration: rowData.celebration || "",
    sleeve_length: rowData.sleeve_length || "",
    neckline: rowData.neckline || "",
    clothing_style: rowData.clothing_style || "",
    capacity: rowData.capacity || "",
    dishwasher_safe: rowData.dishwasher_safe || "false",
    microwave_safe: rowData.microwave_safe || "false",
    orientation: rowData.orientation || "",
    framing: rowData.framing || "",
    aspect_ratio: rowData.aspect_ratio || "",
    graphic: rowData.graphic || "",
  });

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() =>
    (rowData.subject || "").split(",").map(s => s.trim()).filter(Boolean)
  );

  const toggleSubject = (sub: string) => {
    if (selectedSubjects.includes(sub)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== sub));
    } else {
      if (selectedSubjects.length >= 3) {
        toast.error("You can select up to 3 subjects.");
        return;
      }
      setSelectedSubjects([...selectedSubjects, sub]);
    }
  };

  const handleSave = () => {
    setData(prev => {
      const copy = [...prev];
      copy[row] = {
        ...copy[row],
        ...formData,
        subject: selectedSubjects.join(", ")
      };
      return copy;
    });
    toast.success(`Saved attributes for Row ${row + 1}`);
    onClose();
  };

  const category = rowData.category || "";
  const showOccasion = categorySupportsOccasion(category) || categorySupportsCelebration(category);
  const showClothing = ["T-Shirts", "Sweatshirts & Hoodies"].includes(category);
  const showMug = category === "Mugs & Drinkware";
  const showArt = category === "Posters & Prints";
  const showGraphic = categorySupportsGraphic(category);

  const hasSpecificAttributes = showOccasion || showClothing || showMug || showArt || showGraphic;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[9998]"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-[500px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Row {row + 1} - Edit Attributes
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[350px]">
              {rowData.title || "Untitled Product"}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* General Attributes */}
          <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/10">
            <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
              General Attributes
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Primary Color</label>
                <select
                  value={formData.primary_color}
                  onChange={e => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                >
                  {ETSY_COLORS.map(c => (
                    <option key={c} value={c}>{c || "None"}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Secondary Color</label>
                <select
                  value={formData.secondary_color}
                  onChange={e => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                >
                  {ETSY_COLORS.map(c => (
                    <option key={c} value={c}>{c || "None"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Materials</label>
              <input
                type="text"
                placeholder="e.g. Cotton, Polyester"
                value={formData.materials}
                onChange={e => setFormData(prev => ({ ...prev, materials: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Category-Specific Warning/Helper */}
          {!category && (
            <div className="p-3 border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Select a category on the worksheet to enable category-specific attributes.
            </div>
          )}

          {category && !hasSpecificAttributes && (
            <div className="p-3 border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No additional specific attributes are supported for category &ldquo;{category}&rdquo;.
            </div>
          )}

          {/* Gift Occasions Section */}
          {showOccasion && (
            <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/10">
              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                Gift Occasions
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {categorySupportsOccasion(category) && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Occasion</label>
                    <select
                      value={formData.occasion}
                      onChange={e => setFormData(prev => ({ ...prev, occasion: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                    >
                      {ETSY_OCCASIONS.map(o => (
                        <option key={o} value={o}>{o || "None"}</option>
                      ))}
                    </select>
                  </div>
                )}
                {categorySupportsCelebration(category) && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Celebration</label>
                    <select
                      value={formData.celebration}
                      onChange={e => setFormData(prev => ({ ...prev, celebration: e.target.value }))}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                    >
                      {ETSY_CELEBRATIONS.map(c => (
                        <option key={c} value={c}>{c || "None"}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clothing Details Section */}
          {showClothing && (
            <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/10">
              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                Clothing Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Sleeve Length</label>
                  <select
                    value={formData.sleeve_length}
                    onChange={e => setFormData(prev => ({ ...prev, sleeve_length: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                  >
                    {ETSY_SLEEVE_LENGTH.map(s => (
                      <option key={s} value={s}>{s || "None"}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Neckline</label>
                  <select
                    value={formData.neckline}
                    onChange={e => setFormData(prev => ({ ...prev, neckline: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                  >
                    {ETSY_NECKLINE.map(n => (
                      <option key={n} value={n}>{n || "None"}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Clothing Style</label>
                <select
                  value={formData.clothing_style}
                  onChange={e => setFormData(prev => ({ ...prev, clothing_style: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                >
                  {ETSY_CLOTHING_STYLE.map(s => (
                    <option key={s} value={s}>{s || "None"}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Mug Details Section */}
          {showMug && (
            <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/10">
              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                Mug Details
              </h4>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Mug Capacity</label>
                <select
                  value={formData.capacity}
                  onChange={e => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                >
                  {ETSY_MUG_CAPACITY.map(c => (
                    <option key={c} value={c}>{c || "None"}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="dishwasher-safe-checkbox"
                    checked={formData.dishwasher_safe === "true"}
                    onChange={e => setFormData(prev => ({ ...prev, dishwasher_safe: e.target.checked ? "true" : "false" }))}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <label htmlFor="dishwasher-safe-checkbox" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    Dishwasher Safe
                  </label>
                </div>
                <div className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    id="microwave-safe-checkbox"
                    checked={formData.microwave_safe === "true"}
                    onChange={e => setFormData(prev => ({ ...prev, microwave_safe: e.target.checked ? "true" : "false" }))}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <label htmlFor="microwave-safe-checkbox" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    Microwave Safe
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Art Details Section */}
          {showArt && (
            <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/10">
              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                Art Details
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Orientation</label>
                  <select
                    value={formData.orientation}
                    onChange={e => setFormData(prev => ({ ...prev, orientation: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                  >
                    {ETSY_ORIENTATION.map(o => (
                      <option key={o} value={o}>{o || "None"}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Framing</label>
                  <select
                    value={formData.framing}
                    onChange={e => setFormData(prev => ({ ...prev, framing: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                  >
                    {ETSY_FRAMING.map(f => (
                      <option key={f} value={f}>{f || "None"}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Aspect Ratio</label>
                  <select
                    value={formData.aspect_ratio}
                    onChange={e => setFormData(prev => ({ ...prev, aspect_ratio: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                  >
                    {ETSY_ASPECT_RATIO.map(a => (
                      <option key={a} value={a}>{a || "None"}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject checklist */}
              {categorySupportsSubject(category) && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Subject (Max 3)</label>
                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">{selectedSubjects.length} / 3 selected</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border border-zinc-200 dark:border-zinc-800 p-2 max-h-40 overflow-y-auto bg-white dark:bg-zinc-900">
                    {ETSY_SUBJECTS.filter(Boolean).map(sub => {
                      const isChecked = selectedSubjects.includes(sub);
                      const isMaxReached = selectedSubjects.length >= 3 && !isChecked;
                      return (
                        <label 
                          key={sub}
                          className={`flex items-center gap-2 p-1.5 border text-[11px] cursor-pointer transition-colors ${
                            isChecked 
                              ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400" 
                              : isMaxReached 
                                ? "opacity-50 cursor-not-allowed text-zinc-300 dark:text-zinc-600" 
                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isMaxReached}
                            onChange={() => toggleSubject(sub)}
                            className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          {sub}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Graphic Section */}
          {showGraphic && (
            <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/10">
              <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                Graphic
              </h4>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Graphic Style</label>
                <select
                  value={formData.graphic}
                  onChange={e => setFormData(prev => ({ ...prev, graphic: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                >
                  {ETSY_GRAPHICS.map(g => (
                    <option key={g} value={g}>{g || "None"}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
          <button 
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 hover:text-zinc-800 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}

interface VariationsDrawerProps {
  row: number;
  rowData: RowData;
  onClose: () => void;
  setData: React.Dispatch<React.SetStateAction<RowData[]>>;
}

function VariationsDrawer({ row, rowData, onClose, setData }: VariationsDrawerProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [variations, setVariations] = useState<PresetVariations>(() => {
    if (rowData.variations) {
      return JSON.parse(JSON.stringify(rowData.variations)); // deep copy
    }
    return { properties: [], combinations: [], priceOnProperty: [], quantityOnProperty: [], skuOnProperty: [] };
  });

  const [globalPrice, setGlobalPrice] = useState("");
  const [globalQty, setGlobalQty] = useState("");

  const handleApplyGlobalPrice = () => {
    if (!globalPrice || isNaN(parseFloat(globalPrice))) {
      toast.error("Please enter a valid price.");
      return;
    }
    setVariations(prev => {
      const copy = { ...prev };
      copy.combinations = copy.combinations.map(c => ({ ...c, price: globalPrice }));
      return copy;
    });
    setGlobalPrice("");
    toast.success("Applied price to all combinations");
  };

  const handleApplyGlobalQty = () => {
    if (!globalQty || isNaN(parseInt(globalQty))) {
      toast.error("Please enter a valid quantity.");
      return;
    }
    setVariations(prev => {
      const copy = { ...prev };
      copy.combinations = copy.combinations.map(c => ({ ...c, quantity: globalQty }));
      return copy;
    });
    setGlobalQty("");
    toast.success("Applied quantity to all combinations");
  };

  const handleToggleAll = (enabled: boolean) => {
    setVariations(prev => {
      const copy = { ...prev };
      copy.combinations = copy.combinations.map(c => ({ ...c, isEnabled: enabled }));
      return copy;
    });
  };

  const handleSave = () => {
    setData(prev => {
      const copy = [...prev];
      copy[row] = {
        ...copy[row],
        variations
      };
      return copy;
    });
    toast.success(`Saved variations for Row ${row + 1}`);
    onClose();
  };

  const hasProperties = variations.properties && variations.properties.length > 0;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[9998]"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-[550px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Row {row + 1} - Edit Variations
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[400px]">
              {rowData.title || "Untitled Product"}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!hasProperties ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                No variations are configured for this listing.
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto">
                Please configure variations in the Presets Manager first, and apply that preset to this listing.
              </p>
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none space-y-3">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Quick Actions</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={() => handleToggleAll(true)}
                    className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Enable All
                  </button>
                  <button 
                    onClick={() => handleToggleAll(false)}
                    className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Disable All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="flex gap-1.5">
                    <input 
                      type="text" 
                      placeholder="Override all prices..."
                      value={globalPrice}
                      onChange={e => setGlobalPrice(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                    />
                    <button 
                      onClick={handleApplyGlobalPrice}
                      className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input 
                      type="text" 
                      placeholder="Override all quantities..."
                      value={globalQty}
                      onChange={e => setGlobalQty(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                    />
                    <button 
                      onClick={handleApplyGlobalQty}
                      className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {/* Variations Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[450px]">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                    <tr>
                      <th className="p-2 w-10 text-center">Use</th>
                      <th className="p-2">Combination</th>
                      <th className="p-2 w-20">Price</th>
                      <th className="p-2 w-16">Qty</th>
                      <th className="p-2">SKU Suffix</th>
                      <th className="p-2 w-20">Img Slot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-900 dark:text-zinc-100">
                    {variations.combinations.map((comb, idx) => {
                      const combLabel = variations.properties.map(p => comb.values[p.name] || "").join(" / ");
                      return (
                        <tr key={comb.id} className={comb.isEnabled ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/50 dark:bg-zinc-900/20 opacity-60"}>
                          <td className="p-2 text-center">
                            <input 
                              type="checkbox"
                              checked={comb.isEnabled}
                              onChange={e => {
                                setVariations(prev => {
                                  const copy = { ...prev };
                                  copy.combinations = [...copy.combinations];
                                  copy.combinations[idx] = { ...comb, isEnabled: e.target.checked };
                                  return copy;
                                });
                              }}
                              className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-2 font-medium break-all">{combLabel}</td>
                          <td className="p-2">
                            <input 
                              type="text"
                              value={comb.price || ""}
                              placeholder={rowData.price || "19.99"}
                              disabled={!comb.isEnabled}
                              onChange={e => {
                                setVariations(prev => {
                                  const copy = { ...prev };
                                  copy.combinations = [...copy.combinations];
                                  copy.combinations[idx] = { ...comb, price: e.target.value };
                                  return copy;
                                });
                              }}
                              className="w-full px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs focus:outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-zinc-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text"
                              value={comb.quantity || ""}
                              placeholder={rowData.quantity || "100"}
                              disabled={!comb.isEnabled}
                              onChange={e => {
                                setVariations(prev => {
                                  const copy = { ...prev };
                                  copy.combinations = [...copy.combinations];
                                  copy.combinations[idx] = { ...comb, quantity: e.target.value };
                                  return copy;
                                });
                              }}
                              className="w-full px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs focus:outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-zinc-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text"
                              value={comb.skuTemplate || ""}
                              placeholder="{folder}-variant"
                              disabled={!comb.isEnabled}
                              onChange={e => {
                                setVariations(prev => {
                                  const copy = { ...prev };
                                  copy.combinations = [...copy.combinations];
                                  copy.combinations[idx] = { ...comb, skuTemplate: e.target.value };
                                  return copy;
                                });
                              }}
                              className="w-full px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs focus:outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-zinc-900 dark:text-white"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={comb.imageSlot || ""}
                              disabled={!comb.isEnabled}
                              onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                setVariations(prev => {
                                  const copy = { ...prev };
                                  copy.combinations = [...copy.combinations];
                                  copy.combinations[idx] = { ...comb, imageSlot: val };
                                  return copy;
                                });
                              }}
                              className="w-full px-1 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs focus:outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                            >
                              <option value="">None</option>
                              {Array.from({ length: 10 }).map((_, i) => (
                                <option key={i} value={i + 1}>Img {i + 1}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
          <button 
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 hover:text-zinc-800 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!hasProperties}
            className="px-6 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}
