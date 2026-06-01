"use client";

import React, { useCallback, useState, useRef } from "react";
import Image from "next/image";
import DataEditor, {
  DataEditorRef,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  TextCell,
  GridSelection,
} from "@glideapps/glide-data-grid";
import { allCells } from "@glideapps/glide-data-grid-cells";
import "@glideapps/glide-data-grid/dist/index.css";

const COLUMNS: GridColumn[] = [
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
  { title: "Subject", id: "subject", width: 120 },
];

type RowData = {
  folder?: string;
  images?: string;
  video?: string;
  status?: string;
  listing_id?: string;
  context?: string;
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
};

const emptyRow: RowData = {
  status: "",
  listing_id: "",
  context: "",
  images: "",
  video: "",
  alt_text: "",
  digital_file: "",
  title: "",
  description: "",
  tags: "",
  price: "",
  quantity: "",
  category: "Store Graphics",
  section: "",
  primary_color: "",
  occasion: "",
  celebration: "",
  subject: "",
};

export default function SpreadsheetGrid() {
  const gridRef = useRef<DataEditorRef>(null);
  const [columns, setColumns] = useState(COLUMNS);
  const [zoom, setZoom] = useState(1);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>(undefined);
  const [globalImageEditor, setGlobalImageEditor] = useState<{row: number, urls: string[], altTexts: string[]} | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  React.useEffect(() => {
    document.fonts.ready.then(() => {
      setFontsLoaded(true);
    });
  }, []);

  // Load from local storage or initialize with empty rows
  const [data, setData] = useState<RowData[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workstation_v2_grid_data");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {}
      }
    }
    
    return Array.from({ length: 50 }).map(() => ({ ...emptyRow }));
  });

  const dataRef = React.useRef(data);
  // Keep the ref strictly synchronized with the state
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Persist to local storage
  React.useEffect(() => {
    localStorage.setItem("workstation_v2_grid_data", JSON.stringify(data));
  }, [data]);

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

      const value = dataRow[columnId] || "";

      if (columnId === "images") {
        const urlArray = value ? value.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
        const cacheKey = urlArray.join(",");
        
        // Cache the arrays on the component so they are stable references
        // @ts-expect-error - external type mismatch
        if (!window.__glideImageCache) window.__glideImageCache = {};
        // @ts-expect-error - external type mismatch
        if (!window.__glideImageCache[cacheKey]) {
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
           
           // @ts-expect-error - external type mismatch
           window.__glideImageCache[cacheKey] = { absoluteUrlArray, thumbnailUrls };
        }
        
        // @ts-expect-error - external type mismatch
        const { absoluteUrlArray, thumbnailUrls } = window.__glideImageCache[cacheKey];

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
             kind: GridCellKind.Bubble,
             allowOverlay: false,
             data: [],
             themeOverride: {
               bgBubble: "#2b52d6",
               textBubble: "#ffffff",
               bgBubbleSelected: "#2b52d6",
               textBubbleSelected: "#ffffff",
               roundingRadius: 0
             }
           } as GridCell;
        }

        const cacheKey = `tags_${value}`;
        // @ts-expect-error - external type mismatch
        if (!window.__glideTagCache) window.__glideTagCache = {};
        // @ts-expect-error - external type mismatch
        if (!window.__glideTagCache[cacheKey]) {
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
           // @ts-expect-error - external type mismatch
           window.__glideTagCache[cacheKey] = tags;
        }
        // @ts-expect-error - external type mismatch
        const tags = window.__glideTagCache[cacheKey];

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
         let textColor = "#64748b"; // Default slate gray
         if (state === "Generate AI") { textColor = "#a855f7"; }
         else if (state === "Generating...") { textColor = "#f59e0b"; }
         else if (state === "Review") { textColor = "#10b981"; }
         else if (state === "Ready to Push") { textColor = "#3b82f6"; }
         else if (state === "Update Text & SEO") { textColor = "#3b82f6"; }
         else if (state === "Update Images" || state === "Update Digital Files") { textColor = "#3b82f6"; }
         else if (state === "Pushing...") { textColor = "#f59e0b"; }
         else if (state === "Published") { textColor = "#059669"; }
         else if (state === "Error") { textColor = "#ef4444"; }

         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: state,
            data: {
               kind: "dropdown-cell",
               allowedValues: ["Draft", "Generate AI", "Generating...", "Review", "Ready to Push", "Update Text & SEO", "Update Images", "Update Digital Files", "Pushing...", "Published", "Error"],
               value: state
            },
            themeOverride: { 
              textDark: textColor,
              textLight: textColor,
              baseFontStyle: "bold 13px Inter, sans-serif"
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
               allowedValues: ["", "Store Graphics", "Digital Prints"],
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "subject") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ["", "Abstract & geometric", "Animal", "Anime & cartoon", "Architecture & cityscape", "Beach & tropical", "Comics & manga", "Educational", "Fantasy & Sci Fi", "Fashion", "Flowers", "Food & drink", "Horror & gothic", "Humorous saying", "Inspirational saying", "Landscape & scenery", "Love & friendship", "Movie", "Music", "Nautical", "People & portrait", "Pet portrait", "Phrase & saying", "Plants & trees", "Religious", "Science & tech", "Sports & fitness", "Stars & celestial", "Steampunk", "Superhero", "Travel & transportation", "TV", "Typography & symbols", "Video game", "Western & cowboy", "Zodiac"],
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
               allowedValues: ["", "Comfort Colors 1717", "Gilden 5000", "Digital Prints"],
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
               allowedValues: ["", "Beige", "Black", "Blue", "Bronze", "Brown", "Clear", "Copper", "Gold", "Gray", "Green", "Orange", "Pink", "Purple", "Red", "Rose gold", "Silver", "White", "Yellow"],
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "occasion") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ["", "1st birthday", "Anniversary", "Baby shower", "Bachelor party", "Bachelorette party", "Back to school", "Baptism", "Bar & Bat Mitzvah", "Birthday", "Bridal shower", "Confirmation", "Divorce & breakup", "Engagement", "First Communion", "Graduation", "Grief & mourning", "Housewarming", "LGBTQ pride", "Moving", "Pet loss", "Retirement", "Wedding"],
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "celebration") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ["", "Christmas", "Cinco de Mayo", "Dia de los Muertos", "Diwali", "Easter", "Eid", "Father's Day", "Halloween", "Hanukkah", "Holi", "Independence Day", "Kwanzaa", "Lunar New Year", "Mardi Gras", "Mother's Day", "New Year's", "Passover", "Ramadan", "St Patrick's Day", "Thanksgiving", "Valentine's Day", "Veterans Day"],
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      return {
        kind: GridCellKind.Text,
        allowOverlay: true,
        data: value,
        displayData: value,
      } as TextCell;
    },
    [columns]
  );

  const getCellsForSelection = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selection: any) => {
      const result: GridCell[][] = [];
      const { x, y, width, height } = selection;
      for (let r = 0; r < height; r++) {
        const row: GridCell[] = [];
        for (let c = 0; c < width; c++) {
          row.push(getCellContent([x + c, y + r]));
        }
        result.push(row);
      }
      return () => result;
    },
    [getCellContent]
  );

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

    // Add a strict timeout so the grid doesn't hang indefinitely if the AI drops the connection
    // Increased to 3 minutes (180000ms) because Vision AI takes longer to process image files
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); 

    // Trigger AI Pipeline
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
        alert(`AI Generation Failed:\n${aiData.error}`);
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
        alert("AI Generation timed out after 45 seconds. The Google Gemini API might be congested. Please try again.");
      } else {
        alert("AI Generation request completely failed to send.");
      }
    });
  }, []);

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
            alert(`Folder Scan Failed: ${assetData.error || "Unknown error"}. Make sure the folder exists and is spelled correctly.`);
         }
      })
      .catch(err => {
         console.error("Asset scan failed:", err);
         alert("Network error while trying to scan folder.");
      });
  }, [triggerAIGeneration]);

  const onCellEdited = useCallback(
    (cell: Item, newValue: GridCell) => {
      if (newValue.kind !== GridCellKind.Text && newValue.kind !== GridCellKind.Image && newValue.kind !== GridCellKind.Bubble && newValue.kind !== GridCellKind.Custom) return;

      const [col, row] = cell;
      const columnId = columns[col].id as keyof RowData;

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
        const customColumns = ["status", "category", "section", "primary_color", "occasion", "celebration", "subject"];
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
        newDataArray.push({ ...emptyRow });
      }

      newDataArray[row] = {
        ...newDataArray[row],
        [columnId]: newStringValue,
      };
      dataRef.current = newDataArray;
      setData(newDataArray);

      // Automatically scan the folder if the folder name was just typed!
      if (columnId === "folder") {
        triggerFolderAutomation(row, newStringValue);
      }

      // Auto-fill hardcoded values when Category is selected
      if (columnId === "category" && newStringValue === "Store Graphics") {
        const updatedArray = [...dataRef.current];
        updatedArray[row] = {
          ...updatedArray[row],
          category: "Store Graphics",
          price: "3.99",
          quantity: "999"
        };
        dataRef.current = updatedArray;
        setData(updatedArray);
        return; // Early return since we handled the state update
      }

      // Automatically trigger the AI if Status was changed to 'Generate AI'
      if (columnId === "status" && newStringValue === "Generate AI") {
        triggerAIGeneration(row);
        return;
      }

      // Automatically trigger Push/Update to Etsy
      if (columnId === "status" && (newStringValue === "Ready to Push" || newStringValue === "Update Text & SEO" || newStringValue === "Update Images" || newStringValue === "Update Digital Files")) {
        setData((prev) => {
          const newData = [...prev];
          newData[row] = { ...newData[row], status: "Pushing..." };
          dataRef.current = newData;
          return newData;
        });

        const rowDataToPush = { 
          ...dataRef.current[row],
          updateType: newStringValue === "Update Text & SEO" ? "text" :
                      newStringValue === "Update Images" ? "images" : 
                      newStringValue === "Update Digital Files" ? "files" : "all"
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
              newData[row] = { ...newData[row], status: "Published", listing_id: pushData.listing_id.toString() };
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
        return; // Don't write 'Ready to Push' to state below
      }

      setData((prev) => {
        const newData = [...prev];
        newData[row] = {
          ...newData[row],
          [columnId]: newStringValue,
        };
        return newData;
      });


    },
    [columns, triggerFolderAutomation, triggerAIGeneration]
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
            newData.push({ ...emptyRow });
          }
          const dataRow = { ...newData[row + r] };
          for (let c = 0; c < values[r].length; c++) {
            if (col + c >= columns.length) break;
            const columnId = columns[col + c].id;
            if (!columnId) continue;
            // @ts-expect-error - external type mismatch
            dataRow[columnId] = values[r][c];
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
    [columns, triggerFolderAutomation]
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
            newData.push({ ...emptyRow });
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

            // @ts-expect-error - external type mismatch
            destRowData[destColumnId] = sourceRowData[sourceColumnId];
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

        // 2. Delete full rows
        if (selection.rows) {
          const selectedRows = typeof selection.rows.toArray === "function" ? selection.rows.toArray() : Array.from(selection.rows);
          for (const r of selectedRows) {
            if (typeof r !== "number" || r >= newData.length) continue;
            const rowData = { ...newData[r] };
            for (let c = 0; c < columns.length; c++) {
              const col = columns[c];
              if (col.id) {
                // @ts-expect-error - external type mismatch
                rowData[col.id] = "";
                didDelete = true;
                cellsToUpdate.push({ cell: [c, r] });
              }
            }
            newData[r] = rowData as RowData;
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

  return (
    <div className="w-full h-full p-4 bg-white dark:bg-zinc-950" onWheel={onWheel}>
      <div className="w-full h-full border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden relative">
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any}
            rowMarkers="checkbox"
            getCellContent={getCellContent}
            columns={columns}
            rows={data.length + 1}
            rowHeight={Math.floor(Math.max(34 * zoom, 20))}
            headerHeight={Math.floor(Math.max(36 * zoom, 24))}
            fillHandle={true}
            rangeSelect="rect"
            columnSelect="multi"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getCellsForSelection={getCellsForSelection as any}
            onFillPattern={onFillPattern}
            onDelete={onDelete}
            onCellEdited={onCellEdited}
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
