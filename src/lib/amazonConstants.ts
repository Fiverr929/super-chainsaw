import { GridColumn } from "@glideapps/glide-data-grid";

export const AMAZON_COLUMNS: GridColumn[] = [
  { title: "Folder", id: "folder", width: 120 },
  { title: "Images", id: "images", width: 100 },
  { title: "Status", id: "status", width: 100 },
  { title: "ASIN", id: "asin", width: 120 },
  { title: "Parent SKU", id: "sku", width: 130 },
  { title: "Title", id: "title", width: 200 },
  { title: "Description", id: "description", width: 250 },
  { title: "Brand", id: "brand", width: 100 },
  { title: "Price", id: "price", width: 80 },
  { title: "Quantity", id: "quantity", width: 80 },
  { title: "Material", id: "outer_material", width: 120 },
  // Expanded Native Columns
  { title: "Target Gender", id: "target_gender", width: 120 },
  { title: "Department", id: "department_name", width: 120 },
  { title: "Item Type", id: "item_type_name", width: 120 },
  { title: "Fit Type", id: "fit_type", width: 120 },
  { title: "Style Name", id: "style_name", width: 120 },
  { title: "Neck Style", id: "neck_style", width: 120 },
  { title: "Sleeve Type", id: "sleeve_type", width: 120 },
  { title: "Pattern", id: "pattern", width: 120 },
  { title: "Care Instructions", id: "care_instructions", width: 140 },
  { title: "HSN Code", id: "hsn_code", width: 100 },
  { title: "Browse Node", id: "recommended_browse_node", width: 120 },
  // Summary/Drawer Columns
  { title: "Garment Construction", id: "garment_specs", width: 200 },
  { title: "Theme & Features", id: "theme_features", width: 200 },
  { title: "Dimensions & Sizing", id: "dimensions_sizing", width: 200 },
  { title: "Compliance & Origin", id: "compliance_origin", width: 200 },
  { title: "Packaging Details", id: "packaging_specs", width: 150 },
  // End Summary Columns
  { title: "Bullet Points", id: "bullet_points", width: 200 },
  { title: "Search Terms", id: "keywords", width: 200 },
  { title: "Variations", id: "variations", width: 100 }
];
