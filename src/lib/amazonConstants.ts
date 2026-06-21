import { GridColumn } from "@glideapps/glide-data-grid";

export const AMAZON_COLUMNS: GridColumn[] = Array.from({ length: 10 }).map((_, idx) => ({
  title: `Col ${idx + 1}`,
  id: `col_${idx + 1}`,
  width: 120
}));
