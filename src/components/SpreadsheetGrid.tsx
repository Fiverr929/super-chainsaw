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
  Theme,
  Rectangle
} from "@glideapps/glide-data-grid";
import { allCells } from "@glideapps/glide-data-grid-cells";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  ETSY_CATEGORIES,
  ETSY_SUBJECTS,
  ETSY_SECTIONS,
  ETSY_COLORS,
  ETSY_OCCASIONS,
  ETSY_CELEBRATIONS,
  ETSY_STATUSES,
  categorySupportsOccasion,
  categorySupportsCelebration,
  categorySupportsSubject
} from "@/lib/etsyConstants";
import { useAIPipeline } from "@/hooks/useAIPipeline";
import { useEtsyPush } from "@/hooks/useEtsyPush";
import FolderImporterModal from "./FolderImporterModal";
import PresetManagerModal from "./PresetManagerModal";
import { FolderPlus, Layers, ChevronDown, Trash2 } from "lucide-react";

const imageCache: Record<string, { absoluteUrlArray: string[], thumbnailUrls: string[] }> = {};
const tagCache: Record<string, string[]> = {};

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
  who_made: "",
  when_made: "",
  is_supply: "",
  renewal_options: "",
  ai_title_rules: "",
  ai_desc_rules: "",
  ai_tag_rules: "",
};

export default function SpreadsheetGrid() {
  const gridRef = useRef<DataEditorRef>(null);
  const [columns, setColumns] = useState(COLUMNS);
  const [zoom, setZoom] = useState(1);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>(undefined);
  const [globalImageEditor, setGlobalImageEditor] = useState<{row: number, urls: string[], altTexts: string[]} | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Task Queue State
  type QueueTask = { id: string; action: string; row: number };
  const [taskQueue, setTaskQueue] = useState<QueueTask[]>([]);
  const isProcessingQueue = React.useRef(false);
  const [showUpdateMenu, setShowUpdateMenu] = useState(false);
  const [showGenerateMenu, setShowGenerateMenu] = useState(false);
  React.useEffect(() => {
    document.fonts.ready.then(() => {
      setFontsLoaded(true);
    });
  }, []);

  // Initialize with empty rows (avoids Next.js hydration mismatch)
  const [data, setData] = useState<RowData[]>(() => {
    return Array.from({ length: 50 }).map(() => ({ ...emptyRow }));
  });

  // Load from local storage AFTER initial render
  React.useEffect(() => {
    const saved = localStorage.getItem("workstation_v2_grid_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setData(parsed);
        }
      } catch (e) {
        console.error("Failed to parse local storage grid data", e);
      }
    }
    setIsDataLoaded(true);
  }, []);

  const dataRef = React.useRef(data);
  // Keep the ref strictly synchronized with the state
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const { triggerAIGeneration, triggerFolderAutomation } = useAIPipeline(dataRef, setData);
  const { triggerEtsyPush } = useEtsyPush(dataRef, setData);

  const processBulkQueue = (action: string, rows: number[]) => {
    if (rows.length === 0) return;
    setShowUpdateMenu(false);
    setShowGenerateMenu(false);

    const newTasks = rows.map(row => ({
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
      const currentTask = taskQueue[0];
      
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
          await triggerEtsyPush(currentTask.row, "Update Images");
        } else if (currentTask.action === "update_files") {
          await triggerEtsyPush(currentTask.row, "Update Digital Files");
        }
      } catch (err) {
         console.error("Queue task failed:", err);
      } finally {
        setTaskQueue(prev => prev.slice(1));
        isProcessingQueue.current = false;
        
        // Delay to avoid hitting API rate limits if there are more tasks
        if (taskQueue.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };

    processNext();
  }, [taskQueue, triggerAIGeneration, triggerEtsyPush]);

  // Persist to local storage with a 500ms debounce (ONLY after initial load)
  React.useEffect(() => {
    if (!isDataLoaded) return;
    
    const handler = setTimeout(() => {
      localStorage.setItem("workstation_v2_grid_data", JSON.stringify(data));
    }, 500);
    return () => clearTimeout(handler);
  }, [data, isDataLoaded]);

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

      const value = dataRow[columnId] || "";

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
               allowedValues: ETSY_STATUSES,
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
               allowedValues: ETSY_CATEGORIES,
               value: value || ""
            },
            themeOverride: { 
              baseFontStyle: "13px Inter, sans-serif"
            }
         } as GridCell;
      }

      if (columnId === "subject") {
         const supported = !isActiveRow || categorySupportsSubject(dataRow.category || "");
         if (!supported) return { kind: GridCellKind.Text, allowOverlay: false, readonly: true, data: "", displayData: "", themeOverride: { bgCell: "#fafafa" } } as TextCell;
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
      }

      if (columnId === "section") {
         return {
            kind: GridCellKind.Custom,
            allowOverlay: true,
            copyData: value,
            data: {
               kind: "dropdown-cell",
               allowedValues: ETSY_SECTIONS,
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

      // Automatically trigger the AI if Status was changed to 'Generate AI'
      if (columnId === "status" && newStringValue === "Generate AI") {
        if (dataRef.current[row].status === "Generating..." || dataRef.current[row].status === "Pushing...") return;
        triggerAIGeneration(row);
        return;
      }

      // Automatically trigger Push/Update to Etsy
      if (columnId === "status" && (newStringValue === "Ready to Push" || newStringValue === "Update Text & SEO" || newStringValue === "Update Images" || newStringValue === "Update Digital Files")) {
        if (dataRef.current[row].status === "Generating..." || dataRef.current[row].status === "Pushing...") return;
        triggerEtsyPush(row, newStringValue);
        return; // Don't write 'Ready to Push' to state below
      }

    },
    [columns, triggerAIGeneration, triggerEtsyPush]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex-1 w-full border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden relative">
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



      {/* Folder Importer Modal */}
      {isImporterOpen && (
        <FolderImporterModal 
          onClose={() => setIsImporterOpen(false)}
          onImport={(selectedFolders, preset) => {
            const newRows = selectedFolders.map(folderName => {
              const row: RowData = { ...emptyRow, folder: folderName };
              if (preset) {
                row.category = preset.category || "Store Graphics";
                row.section = preset.section || "";
                row.price = preset.price || "";
                row.quantity = preset.quantity || "";
                row.context = preset.context || "";
                row.occasion = preset.occasion || "";
                row.celebration = preset.celebration || "";
                row.subject = preset.subject || "";
                row.who_made = preset.who_made || "i_did";
                row.when_made = preset.when_made || "2020_2024";
                row.is_supply = preset.is_supply || "false";
                row.renewal_options = preset.renewal_options || "automatic";
                row.ai_title_rules = preset.ai_title_rules || "";
                row.ai_desc_rules = preset.ai_desc_rules || "";
                row.ai_tag_rules = preset.ai_tag_rules || "";
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
                  <button onClick={() => processBulkQueue('update_images', selectedRowsList)} className="text-left px-3 py-2 text-sm hover:bg-blue-700 transition-colors">Images</button>
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

      {/* Preset Manager Modal */}
      {showPresets && <PresetManagerModal onClose={() => setShowPresets(false)} />}
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
