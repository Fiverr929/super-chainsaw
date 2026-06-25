"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { RowData } from "./SpreadsheetGrid";

export type AmazonDrawerType = "garment_specs" | "theme_features" | "dimensions_sizing" | "compliance_origin" | "packaging_specs";

interface AmazonDrawerProps {
  row: number;
  rowData: RowData;
  type: AmazonDrawerType;
  onClose: () => void;
  setData: React.Dispatch<React.SetStateAction<RowData[]>>;
}

export default function AmazonDrawer({ row, rowData, type, onClose, setData }: AmazonDrawerProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!rowData) return null;

  const [formData, setFormData] = useState({
    // garment_specs
    collar_style: rowData.collar_style || "",
    sleeve_length: rowData.sleeve_length || "",
    sleeve_cuff: rowData.sleeve_cuff || "",
    top_style: rowData.top_style || "",
    shirt_form_type: rowData.shirt_form_type || "",
    hemline_form: rowData.hemline_form || "",
    closure_type: rowData.closure_type || "",
    apparel_fabric_stretch: rowData.apparel_fabric_stretch || "",
    apparel_fabric_weight_class: rowData.apparel_fabric_weight_class || "",
    fabric_stretchability: rowData.fabric_stretchability || "",
    // theme_features
    theme: rowData.theme || "",
    subject_character: rowData.subject_character || "",
    animal_theme: rowData.animal_theme || "",
    special_features: rowData.special_features || "",
    fashion_decade: rowData.fashion_decade || "",
    seasons: rowData.seasons || "",
    embellishment_feature: rowData.embellishment_feature || "",
    pocket_description: rowData.pocket_description || "",
    number_of_pockets: rowData.number_of_pockets || "",
    // dimensions_sizing
    size_system: rowData.size_system || "",
    item_dimension_length: rowData.item_dimension_length || "",
    item_dimension_width: rowData.item_dimension_width || "",
    item_dimension_height: rowData.item_dimension_height || "",
    item_dimension_unit: rowData.item_dimension_unit || "",
    item_weight: rowData.item_weight || "",
    item_weight_unit: rowData.item_weight_unit || "",
    garment_size_country: rowData.garment_size_country || "",
    shoulder_hem_length: rowData.shoulder_hem_length || "",
    shoulder_hem_unit: rowData.shoulder_hem_unit || "",
    item_length_description: rowData.item_length_description || "",
    // compliance_origin
    manufacturer_address: rowData.manufacturer_address || "",
    packer_address: rowData.packer_address || "",
    age_range_description: rowData.age_range_description || "",
    part_number: rowData.part_number || "",
    model_name: rowData.model_name || "",
    model_number: rowData.model_number || "",
    product_id_exemption: rowData.product_id_exemption || "",
    // packaging_specs
    number_of_items: rowData.number_of_items || "",
    item_package_quantity: rowData.item_package_quantity || "",
    unit_count: rowData.unit_count || "",
    unit_count_type: rowData.unit_count_type || "",
  });

  const handleSave = () => {
    setData(prev => {
      const copy = [...prev];
      copy[row] = { ...copy[row], ...formData };
      return copy;
    });
    toast.success(`Saved Amazon specs for Row ${row + 1}`);
    onClose();
  };

  const titles = {
    garment_specs: "Garment Construction",
    theme_features: "Theme & Features",
    dimensions_sizing: "Dimensions & Sizing",
    compliance_origin: "Compliance & Origin",
    packaging_specs: "Packaging Details"
  };

  const fieldsByType = {
    garment_specs: ["collar_style", "sleeve_length", "sleeve_cuff", "top_style", "shirt_form_type", "hemline_form", "closure_type", "apparel_fabric_stretch", "apparel_fabric_weight_class", "fabric_stretchability"],
    theme_features: ["theme", "subject_character", "animal_theme", "special_features", "fashion_decade", "seasons", "embellishment_feature", "pocket_description", "number_of_pockets"],
    dimensions_sizing: ["size_system", "item_length_description", "item_dimension_length", "item_dimension_width", "item_dimension_height", "item_dimension_unit", "garment_size_country", "shoulder_hem_length", "shoulder_hem_unit", "item_weight", "item_weight_unit"],
    compliance_origin: ["manufacturer_address", "packer_address", "age_range_description", "part_number", "model_name", "model_number", "product_id_exemption"],
    packaging_specs: ["number_of_items", "item_package_quantity", "unit_count", "unit_count_type"]
  };

  const formatLabel = (key: string) => {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10 dark:bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[400px] bg-white dark:bg-zinc-950 shadow-2xl z-50 flex flex-col border-l border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 shrink-0">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
              Row {row + 1} - {titles[type]}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-sm text-zinc-500">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/10">
            <h4 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
              {titles[type]}
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {fieldsByType[type].map((fieldKey) => (
                <div key={fieldKey} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{formatLabel(fieldKey)}</label>
                  <input
                    type="text"
                    value={(formData as any)[fieldKey]}
                    onChange={e => setFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 shrink-0 bg-zinc-50 dark:bg-zinc-900 mt-2">
          <button onClick={onClose} className="px-6 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors rounded-none">
            Cancel
          </button>
          <button onClick={handleSave} className="px-8 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm rounded-none">
            Apply & Save
          </button>
        </div>
      </div>
    </>
  );
}
