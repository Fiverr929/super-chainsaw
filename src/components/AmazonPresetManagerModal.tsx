'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { PresetVariations, VariationCombination } from './PresetManagerModal';

export type AmazonPreset = {
  id: string;
  name: string;
  
  // Core Settings
  brand: string;
  sku_template: string;
  price: string;
  quantity: string;
  maximum_retail_price: string;
  minimum_seller_allowed_price: string;
  maximum_seller_allowed_price: string;
  outer_material: string;
  outer_material_auto?: boolean;
  bullet_points: string;
  bullet_points_auto?: boolean;
  keywords: string;
  keywords_auto?: boolean;
  hsn_code: string;
  
  // Apparel Specs
  neck_style: string;
  sleeve_type: string;
  sleeve_length: string;
  sleeve_cuff: string;
  top_style: string;
  shirt_form_type: string;
  hemline_form: string;
  closure_type: string;
  item_type_name: string;
  item_type_name_auto?: boolean;
  apparel_fabric_stretch: string;
  apparel_fabric_weight_class: string;
  fabric_stretchability: string;
  fabric_stretchability_auto?: boolean;
  
  // Design & Theme
  special_features: string;
  special_features_auto?: boolean;
  pattern: string;
  pattern_auto?: boolean;
  theme: string;
  theme_auto?: boolean;
  subject_character: string;
  subject_character_auto?: boolean;
  animal_theme: string;
  animal_theme_auto?: boolean;
  pocket_description: string;
  pocket_description_auto?: boolean;
  number_of_pockets: string;
  number_of_pockets_auto?: boolean;
  fashion_decade: string;
  seasons: string;
  seasons_auto?: boolean;
  embellishment_feature: string;
  embellishment_feature_auto?: boolean;
  
  // Compliance & Sizing
  manufacturer_address: string;
  packer_address: string;
  target_gender: string;
  age_range_description: string;
  department_name: string;
  care_instructions: string;
  part_number: string;
  part_number_auto?: boolean;
  number_of_items: string;
  item_package_quantity: string;
  item_weight: string;
  item_weight_unit: string;
  garment_size_country: string;
  shoulder_hem_length: string;
  shoulder_hem_length_auto?: boolean;
  shoulder_hem_unit: string;
  unit_count: string;
  unit_count_type: string;
  sport_type: string;
  sport_type_auto?: boolean;
  league_name: string;
  league_name_auto?: boolean;
  team_name: string;
  team_name_auto?: boolean;
  lifestyle: string;
  lifestyle_auto?: boolean;
  is_customizable: string;
  is_green_purchasing_law_compliant: string;
  product_site_launch_date: string;
  
  variations?: PresetVariations;
  [key: string]: any;
};

export const DEFAULT_AMAZON_PRESET: AmazonPreset = {
  id: "default-amazon",
  name: "Amazon T-Shirt Default",
  brand: "Yivez",
  sku_template: "YIVEZ-{folder:4}-{color}-{size}",
  price: "1200",
  quantity: "100",
  maximum_retail_price: "1999",
  minimum_seller_allowed_price: "499",
  maximum_seller_allowed_price: "2499",
  outer_material: "Cotton",
  outer_material_auto: false,
  bullet_points: "100% Cotton, Comfort fit, Perfect for daily wear",
  bullet_points_auto: true,
  keywords: "graphic tee, crop top, y2k style",
  keywords_auto: true,
  hsn_code: "61091000",
  
  neck_style: "Auto",
  sleeve_type: "Auto",
  sleeve_length: "Auto",
  sleeve_cuff: "None",
  top_style: "None",
  shirt_form_type: "None",
  hemline_form: "None",
  closure_type: "None",
  item_type_name: "T-Shirt",
  item_type_name_auto: false,
  apparel_fabric_stretch: "None",
  apparel_fabric_weight_class: "None",
  fabric_stretchability: "",
  fabric_stretchability_auto: true,
  
  special_features: "",
  special_features_auto: true,
  pattern: "",
  pattern_auto: true,
  theme: "",
  theme_auto: true,
  subject_character: "",
  subject_character_auto: true,
  animal_theme: "",
  animal_theme_auto: true,
  pocket_description: "",
  pocket_description_auto: true,
  number_of_pockets: "",
  number_of_pockets_auto: true,
  fashion_decade: "None",
  seasons: "",
  seasons_auto: true,
  embellishment_feature: "",
  embellishment_feature_auto: true,
  
  manufacturer_address: "Yivez, Somanur Road, Karumathampatti, Coimbatore, Tamil Nadu - 641659, India",
  packer_address: "Yivez, Somanur Road, Karumathampatti, Coimbatore, Tamil Nadu - 641659, India",
  target_gender: "Auto",
  age_range_description: "Auto",
  department_name: "Auto",
  care_instructions: "Auto",
  part_number: "",
  part_number_auto: true,
  number_of_items: "1",
  item_package_quantity: "1",
  item_weight: "150.0",
  item_weight_unit: "grams",
  garment_size_country: "IN",
  shoulder_hem_length: "",
  shoulder_hem_length_auto: true,
  shoulder_hem_unit: "inches",
  unit_count: "1",
  unit_count_type: "Count",
  sport_type: "",
  sport_type_auto: true,
  league_name: "",
  league_name_auto: true,
  team_name: "",
  team_name_auto: true,
  lifestyle: "",
  lifestyle_auto: true,
  is_customizable: "No",
  is_green_purchasing_law_compliant: "No",
  product_site_launch_date: "2026-06-21",
  
  variations: {
    properties: [
      { name: "Color", propertyId: 1, options: ["White"] },
      { name: "Size", propertyId: 2, options: ["S", "M", "L"] }
    ],
    combinations: [
      { id: "White-S", values: { Color: "White", Size: "S" }, isEnabled: true, price: "750", quantity: "100" },
      { id: "White-M", values: { Color: "White", Size: "M" }, isEnabled: true, price: "750", quantity: "100" },
      { id: "White-L", values: { Color: "White", Size: "L" }, isEnabled: true, price: "750", quantity: "100" }
    ],
    priceOnProperty: [],
    quantityOnProperty: [],
    skuOnProperty: []
  }
};

const AMAZON_NECK_STYLES = [
  "Crew Neck", "V-Neck", "Round Neck", "Boat Neck", "Halter Neck", "High Neck", 
  "Hooded Neck", "Mock Neck", "Turtle Neck", "Square Neck", "Off Shoulder Neck", "Asymmetric Neck"
];

const AMAZON_COLLAR_STYLES = [
  "Collarless", "Button-Down", "Spread", "Mandarin", "Polo"
];

const AMAZON_SLEEVE_LENGTHS = [
  "3/4 Sleeve", "Bracelet Sleeve", "Half Sleeve", "Long Sleeve", "Short Sleeve", "Sleeveless"
];

const AMAZON_SLEEVE_TYPES = [
  "Balloon Sleeve", "Batwing Sleeve", "Bell Sleeve", "Bishop Sleeve", 
  "Butterfly Sleeve", "Cap Sleeve", "Cape Sleeve", "Cold Shoulder Sleeve", 
  "Cuff Sleeve", "Dolman Sleeve", "Flutter Sleeve", "Gathered Sleeve", 
  "Kimono Sleeve", "Lantern Sleeve", "Long Sleeve", "Puff Sleeve", 
  "Raglan Sleeve", "Roll Up Sleeve", "Short Sleeve", "Sleeveless", 
  "Slit Sleeve", "Strapless"
];

const AMAZON_SLEEVE_CUFFS = [
  "Rolled", "Open", "Ribbed Cuff", "Barrel Cuff", "French Cuff", "Single Cuff"
];

const AMAZON_TARGET_GENDERS = [
  "unisex", "female", "male"
];

const AMAZON_AGE_RANGES = [
  "adult", "teen", "child", "infant"
];

const AMAZON_DEPARTMENTS = [
  "women", "men", "unisex-adult", "girls", "boys"
];

const AMAZON_CARE_INSTRUCTIONS = [
  "Machine Wash", "Hand Wash", "Dry Clean Only", "Do Not Wash", "Line Dry"
];

const AMAZON_FABRIC_STRETCHES = [
  "high_stretch", "low_stretch", "medium_stretch", "no_stretch"
];

const AMAZON_WEIGHT_CLASSES = [
  "heavyweight", "lightweight", "medium_weight"
];

const AMAZON_FASHION_DECADES = [
  "1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s"
];

const AMAZON_GARMENT_SIZE_COUNTRIES = [
  "IN", "US", "GB", "EU", "JP", "FR", "DE", "IT", "CA", "AU"
];

const AMAZON_HEMLINE_FORMS = [
  "straight_hemline", "high_low_hemline", "asymmetric_hemline", "curved_hemline", "shirttail_hemline"
];

const AMAZON_TOP_STYLES = [
  "Blouson", "Camisole", "Kaftan", "Tunic", "Kimono", "Corset"
];

const AMAZON_SHIRT_FORM_TYPES = [
  "T-Shirt", "Button-Down", "Polo", "Henley", "Tank Top"
];

const AMAZON_CLOSURE_TYPES = [
  "Button", "Zipper", "Snap", "Pull On", "Drawstring", "Hook and Eye", "Hook and Loop", "Buckle"
];

const AMAZON_ITEM_TYPE_NAMES = [
  "T-Shirt", "Shirt", "Polo", "Sweatshirt", "Hoodie", "Jacket", "Tank Top"
];

const AMAZON_FABRIC_STRETCHABILITIES = [
  "stretchable", "non_stretchable", "slightly_stretchable"
];

const AMAZON_SPECIAL_FEATURES = [
  "Moisture Wicking", "Lightweight", "Breathable", "Water Resistant", "Quick Dry"
];

const AMAZON_PATTERNS = [
  "Floral", "Solid", "Striped", "Plaid", "Polka Dot", "Geometric", "Animal Print"
];

const AMAZON_THEMES = [
  "Animals", "Sports", "Music", "Movies", "Holidays", "Nature", "Space"
];

const AMAZON_SUBJECT_CHARACTERS = [
  "Batman", "Superman", "Spider-Man", "Mickey Mouse", "Harry Potter", "Star Wars"
];

const AMAZON_ANIMAL_THEMES = [
  "Alpaca", "Cat", "Dog", "Dinosaur", "Bear", "Lion", "Tiger"
];

const AMAZON_POCKET_DESCRIPTIONS = [
  "Basic-5-Pocket", "Slant", "Flap", "Patch", "Cargo", "No Pocket"
];

const AMAZON_NUMBER_OF_POCKETS = [
  "1", "2", "3", "4", "5", "6"
];

const AMAZON_SEASONS = [
  "Summer", "Spring", "Winter", "Autumn", "All-Season"
];

const AMAZON_EMBELLISHMENT_FEATURES = [
  "Buckle", "Applique", "Embroidery", "Lace", "Sequin", "Beaded", "Ruffle"
];


interface AmazonPresetManagerModalProps {
  onClose: () => void;
  selectedRowsCount: number;
  onApplyPreset: (preset: AmazonPreset) => void;
}

export default function AmazonPresetManagerModal({ onClose, selectedRowsCount, onApplyPreset }: AmazonPresetManagerModalProps) {
  const [presets, setPresets] = useState<AmazonPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>('');
  const [editForm, setEditForm] = useState<AmazonPreset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [activeTab, setActiveTab] = useState<'core' | 'specs' | 'design' | 'compliance' | 'variations'>('core');

  useEffect(() => {
    const saved = localStorage.getItem('workstation_v2_presets_amazon');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPresets(parsed);
        if (parsed.length > 0) {
          setActivePresetId(parsed[0].id);
          setEditForm({ ...parsed[0] });
        }
      } catch (e) {
        console.error("Failed to parse Amazon presets", e);
        setPresets([DEFAULT_AMAZON_PRESET]);
        setActivePresetId(DEFAULT_AMAZON_PRESET.id);
        setEditForm({ ...DEFAULT_AMAZON_PRESET });
      }
    } else {
      setPresets([DEFAULT_AMAZON_PRESET]);
      setActivePresetId(DEFAULT_AMAZON_PRESET.id);
      setEditForm({ ...DEFAULT_AMAZON_PRESET });
      localStorage.setItem('workstation_v2_presets_amazon', JSON.stringify([DEFAULT_AMAZON_PRESET]));
    }
  }, []);

  const handleSelectPreset = (id: string) => {
    setActivePresetId(id);
    const chosen = presets.find(p => p.id === id);
    if (chosen) {
      setEditForm(JSON.parse(JSON.stringify(chosen)));
      setIsCreatingNew(false);
      setActiveTab('core');
    }
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    const newPreset: AmazonPreset = JSON.parse(JSON.stringify(DEFAULT_AMAZON_PRESET));
    newPreset.id = "preset-amazon-" + Date.now();
    newPreset.name = "New Amazon Preset";
    setEditForm(newPreset);
    setActiveTab('core');
  };

  const handleSaveEdit = () => {
    if (!editForm) return;

    let newPresets = [...presets];
    if (isCreatingNew) {
      newPresets.push(editForm);
      setIsCreatingNew(false);
    } else {
      const idx = newPresets.findIndex(p => p.id === editForm.id);
      if (idx !== -1) {
        newPresets[idx] = editForm;
      }
    }

    setPresets(newPresets);
    setActivePresetId(editForm.id);
    localStorage.setItem('workstation_v2_presets_amazon', JSON.stringify(newPresets));
    toast.success("Preset saved successfully!");
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (presets.length <= 1) {
      toast.error("You must keep at least one preset.");
      return;
    }

    const newPresets = presets.filter(p => p.id !== id);
    setPresets(newPresets);
    
    if (activePresetId === id) {
      setActivePresetId(newPresets[0].id);
      setEditForm(JSON.parse(JSON.stringify(newPresets[0])));
    }
    
    localStorage.setItem('workstation_v2_presets_amazon', JSON.stringify(newPresets));
    toast.success("Preset deleted.");
  };

  const handleApply = () => {
    if (!editForm) return;
    onApplyPreset(editForm);
    toast.success("Preset applied to selected rows!");
    onClose();
  };

  const addVariationProperty = (name: string, id: number) => {
    if (!editForm) return;
    const properties = [...(editForm.variations?.properties || [])];
    if (properties.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Property already exists.");
      return;
    }
    properties.push({ name, propertyId: id, options: [] });
    setEditForm({
      ...editForm,
      variations: {
        properties,
        combinations: [],
        priceOnProperty: editForm.variations?.priceOnProperty || [],
        quantityOnProperty: editForm.variations?.quantityOnProperty || [],
        skuOnProperty: editForm.variations?.skuOnProperty || []
      }
    });
  };

  const removeVariationProperty = (idx: number) => {
    if (!editForm) return;
    const properties = (editForm.variations?.properties || []).filter((_, i) => i !== idx);
    setEditForm({
      ...editForm,
      variations: {
        properties,
        combinations: [],
        priceOnProperty: editForm.variations?.priceOnProperty || [],
        quantityOnProperty: editForm.variations?.quantityOnProperty || [],
        skuOnProperty: editForm.variations?.skuOnProperty || []
      }
    });
  };

  const updatePropertyOptions = (propIdx: number, options: string[]) => {
    if (!editForm) return;
    const properties = [...(editForm.variations?.properties || [])];
    if (properties[propIdx]) {
      properties[propIdx] = { ...properties[propIdx], options };
    }
    setEditForm({
      ...editForm,
      variations: {
        properties,
        combinations: editForm.variations?.combinations || [],
        priceOnProperty: editForm.variations?.priceOnProperty || [],
        quantityOnProperty: editForm.variations?.quantityOnProperty || [],
        skuOnProperty: editForm.variations?.skuOnProperty || []
      }
    });
  };

  const generateMatrixCombinations = () => {
    if (!editForm) return;
    const properties = editForm.variations?.properties || [];
    if (properties.length === 0) {
      toast.error("Please add at least one property first.");
      return;
    }
    if (properties.some(p => p.options.length === 0)) {
      toast.error("Please add options to all properties first.");
      return;
    }

    const cartesian = (arrays: string[][]): string[][] => {
      return arrays.reduce((acc: string[][], curr: string[]) => {
        return acc.flatMap((d: string[]) => curr.map((e: string) => [...d, e]));
      }, [[]]);
    };

    const arrays = properties.map(p => p.options);
    const product = cartesian(arrays);

    const existingCombinations = editForm.variations?.combinations || [];
    const newCombinations = product.map((optionValues: string[]) => {
      const values: Record<string, string> = {};
      properties.forEach((p, idx) => {
        values[p.name] = optionValues[idx];
      });

      const id = optionValues.join("-");
      const existing = existingCombinations.find(c => {
        return properties.every(p => c.values[p.name] === values[p.name]);
      });

      if (existing) {
        return { ...existing, id };
      }

      return {
        id,
        values,
        isEnabled: true,
        price: editForm.price || "1200",
        quantity: editForm.quantity || "100"
      } as VariationCombination;
    });

    setEditForm({
      ...editForm,
      variations: {
        properties,
        combinations: newCombinations,
        priceOnProperty: editForm.variations?.priceOnProperty || [],
        quantityOnProperty: editForm.variations?.quantityOnProperty || [],
        skuOnProperty: editForm.variations?.skuOnProperty || []
      }
    });
    toast.success("Combinations synced. Save preset to persist changes!");
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const renderAutoTextField = (label: string, field: keyof AmazonPreset, placeholder = "") => {
    if (!editForm) return null;
    const autoField = `${String(field)}_auto`;
    const isAuto = !!editForm[autoField];
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-400">{label}</label>
          <label className="flex items-center gap-1 text-[11px] text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAuto}
              onChange={(e) => setEditForm({ ...editForm, [autoField]: e.target.checked })}
              className="w-3.5 h-3.5 text-blue-600 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500 rounded-none"
            />
            Auto
          </label>
        </div>
        <input
          type="text"
          value={isAuto ? "Auto (AI Deduces dynamically)" : (editForm[field] || "")}
          disabled={isAuto}
          onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
          className={`w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
            isAuto ? "opacity-60 bg-zinc-100 dark:bg-zinc-800 text-zinc-500" : ""
          }`}
          placeholder={placeholder}
        />
      </div>
    );
  };

  const renderDropdownField = (label: string, field: keyof AmazonPreset, options: string[]) => {
    if (!editForm) return null;
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-400">{label}</label>
        <select
          value={editForm[field] || "Auto"}
          onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="Auto" className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold">Auto (AI Deduces)</option>
          <option value="None" className="text-zinc-500 italic">None (Omit)</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  };

  const renderStaticField = (label: string, field: keyof AmazonPreset, placeholder = "") => {
    if (!editForm) return null;
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-400">{label}</label>
        <input
          type="text"
          value={editForm[field] || ""}
          onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          placeholder={placeholder}
        />
      </div>
    );
  };

  const renderYesNoField = (label: string, field: keyof AmazonPreset) => {
    if (!editForm) return null;
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-400">{label}</label>
        <select
          value={editForm[field] || "No"}
          onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/50 p-4" onClick={handleClose}>
      <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 w-full max-w-5xl flex flex-col overflow-hidden shadow-2xl" style={{ height: "85vh", minHeight: "650px", maxHeight: "900px" }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Amazon Listing Presets</h2>
          <button onClick={handleClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 rounded-none">
            <X size={18} />
          </button>
        </div>

        {/* Content Area - Split View */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          
          {/* Left Side: Preset List */}
          <div className="w-1/4 border-r border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-300 dark:border-zinc-700 shrink-0">
              <button 
                onClick={handleCreateNew}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-650 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-none shadow-sm uppercase tracking-wider"
              >
                <Plus size={14} /> Create Preset
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {presets.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className={`group flex items-center justify-between p-3 border-b border-zinc-250 dark:border-zinc-800 cursor-pointer ${
                    activePresetId === p.id && !isCreatingNew
                      ? 'bg-blue-50 dark:bg-blue-900/10 border-l-2 border-l-blue-500'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-850'
                  }`}
                >
                  <div className="overflow-hidden pr-2">
                    <h4 className={`text-xs font-bold truncate uppercase tracking-wider ${activePresetId === p.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-850 dark:text-zinc-200'}`}>
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                      Brand: {p.brand} ? Rs {p.price}
                    </p>
                  </div>
                  {!isCreatingNew && presets.length > 1 && (
                    <button
                      onClick={(e) => handleDeletePreset(p.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Preset Editor */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
            {editForm ? (
              <>
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 shrink-0">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Preset Name:</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-none focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold max-w-sm"
                    />
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0 select-none overflow-x-auto">
                  {(['core', 'specs', 'design', 'compliance', 'variations'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 border-r border-zinc-300 dark:border-zinc-750 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeTab === tab
                          ? 'bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 border-b-2 border-b-blue-500 font-bold'
                          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {tab === 'core' && 'Core Settings'}
                      {tab === 'specs' && 'Apparel Specs'}
                      {tab === 'design' && 'Design & Theme'}
                      {tab === 'compliance' && 'Compliance & Sizing'}
                      {tab === 'variations' && 'Variations'}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-5">
                  
                  {activeTab === 'core' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {renderStaticField("Brand Name", "brand", "Yivez")}
                        {renderAutoTextField("Outer Material / Fabric Type", "outer_material", "Cotton")}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderStaticField("Custom SKU Template", "sku_template", "YIVEZ-{folder:4}-{color}-{size}")}
                        {renderStaticField("HSN Code", "hsn_code", "61091000")}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderStaticField("Default Price (Rs)", "price", "1200")}
                        {renderStaticField("Maximum Retail Price (MRP)", "maximum_retail_price", "1999")}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderStaticField("Minimum Seller Allowed Price", "minimum_seller_allowed_price", "499")}
                        {renderStaticField("Maximum Seller Allowed Price", "maximum_seller_allowed_price", "2499")}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderStaticField("Default Quantity", "quantity", "100")}
                        {renderAutoTextField("Generic Keywords / Search Terms", "keywords", "graphic tee, crop top")}
                      </div>

                      {renderAutoTextField("Bullet Points", "bullet_points", "Comfort fit, 100% Cotton")}
                    </div>
                  )}

                  {activeTab === 'specs' && (
                    <div className="grid grid-cols-2 gap-4">
                      {renderDropdownField("Neck Style", "neck_style", AMAZON_NECK_STYLES)}
                      {renderDropdownField("Collar Style", "collar_style", AMAZON_COLLAR_STYLES)}
                      
                      {renderDropdownField("Sleeve Type", "sleeve_type", AMAZON_SLEEVE_TYPES)}
                      {renderDropdownField("Sleeve Length Description", "sleeve_length", AMAZON_SLEEVE_LENGTHS)}
                      
                      {renderDropdownField("Sleeve Cuff Style", "sleeve_cuff", AMAZON_SLEEVE_CUFFS)}
                      {renderDropdownField("Top Style", "top_style", AMAZON_TOP_STYLES)}
                      
                      {renderDropdownField("Shirt Form Type", "shirt_form_type", AMAZON_SHIRT_FORM_TYPES)}
                      {renderDropdownField("Closure Type", "closure_type", AMAZON_CLOSURE_TYPES)}
                      
                      {renderDropdownField("Apparel Fabric Stretch", "apparel_fabric_stretch", AMAZON_FABRIC_STRETCHES)}
                      {renderDropdownField("Apparel Fabric Weight Class", "apparel_fabric_weight_class", AMAZON_WEIGHT_CLASSES)}
                      
                      {renderDropdownField("Item Type Name", "item_type_name", AMAZON_ITEM_TYPE_NAMES)}
                      {renderDropdownField("Fabric Stretchability", "fabric_stretchability", AMAZON_FABRIC_STRETCHABILITIES)}
                    </div>
                  )}

                  {activeTab === 'design' && (
                    <div className="grid grid-cols-2 gap-4">
                      {renderDropdownField("Special Feature", "special_features", AMAZON_SPECIAL_FEATURES)}
                      {renderDropdownField("Pattern", "pattern", AMAZON_PATTERNS)}
                      
                      {renderDropdownField("Theme", "theme", AMAZON_THEMES)}
                      {renderDropdownField("Subject Character", "subject_character", AMAZON_SUBJECT_CHARACTERS)}
                      
                      {renderDropdownField("Animal Theme", "animal_theme", AMAZON_ANIMAL_THEMES)}
                      {renderDropdownField("Pocket Description", "pocket_description", AMAZON_POCKET_DESCRIPTIONS)}
                      
                      {renderDropdownField("Number of Pockets", "number_of_pockets", AMAZON_NUMBER_OF_POCKETS)}
                      {renderDropdownField("Fashion Decade", "fashion_decade", AMAZON_FASHION_DECADES)}
                      
                      {renderDropdownField("Seasons", "seasons", AMAZON_SEASONS)}
                      {renderDropdownField("Embellishment Feature", "embellishment_feature", AMAZON_EMBELLISHMENT_FEATURES)}
                    </div>
                  )}

                  {activeTab === 'compliance' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {renderDropdownField("Target Gender", "target_gender", AMAZON_TARGET_GENDERS)}
                        {renderDropdownField("Age Range Description", "age_range_description", AMAZON_AGE_RANGES)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {renderDropdownField("Department Name", "department_name", AMAZON_DEPARTMENTS)}
                        {renderDropdownField("Care Instructions", "care_instructions", AMAZON_CARE_INSTRUCTIONS)}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderAutoTextField("Part Number", "part_number", "SKU123")}
                        {renderDropdownField("Garment Size Country", "garment_size_country", AMAZON_GARMENT_SIZE_COUNTRIES)}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {renderStaticField("Number of Items", "number_of_items", "1")}
                        {renderStaticField("Item Package Quantity", "item_package_quantity", "1")}
                        {renderStaticField("Product Site Launch Date (YYYY-MM-DD)", "product_site_launch_date", "2026-06-21")}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid grid-cols-2 gap-2">
                          {renderStaticField("Item Weight", "item_weight", "150.0")}
                          {renderDropdownField("Item Weight Unit", "item_weight_unit", ["grams", "ounces", "pounds", "kilograms"])}
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-semibold">
                          {renderAutoTextField("Shoulder to Hem Length", "shoulder_hem_length", "20.0")}
                          {renderDropdownField("Shoulder to Hem Unit", "shoulder_hem_unit", ["inches", "centimeters", "yards"])}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid grid-cols-2 gap-2">
                          {renderStaticField("Unit Count", "unit_count", "1")}
                          {renderDropdownField("Unit Count Type", "unit_count_type", ["Count", "Grams", "Ounces", "Fl Oz"])}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {renderYesNoField("Is Customizable?", "is_customizable")}
                          {renderYesNoField("Is Green Law Compliant", "is_green_purchasing_law_compliant")}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderAutoTextField("Sport Type", "sport_type", "Athletic")}
                        {renderAutoTextField("Lifestyle", "lifestyle", "Athletic")}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {renderAutoTextField("League Name", "league_name", "NBA")}
                        {renderAutoTextField("Team Name", "team_name", "Seattle Seahawks")}
                      </div>

                      {renderStaticField("Manufacturer Contact Info", "manufacturer_address", "Street Address...")}
                      {renderStaticField("Packer Contact Info", "packer_address", "Street Address...")}
                    </div>
                  )}

                  {activeTab === 'variations' && (
                    <div className="space-y-4">
                      <div className="border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-none space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Variation Properties</h4>
                          {(!editForm.variations?.properties || editForm.variations.properties.length < 2) && (
                            <select
                              className="text-xs px-2 py-1 rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                              onChange={(e) => {
                                if (e.target.value === "custom") {
                                  const name = prompt("Enter property name:");
                                  if (name) addVariationProperty(name, Date.now());
                                } else if (e.target.value) {
                                  addVariationProperty(e.target.value, Date.now());
                                }
                                e.target.value = "";
                              }}
                            >
                              <option value="">+ Add Property...</option>
                              {!(editForm.variations?.properties || []).some(p => p.name === "Color") && <option value="Color">Color</option>}
                              {!(editForm.variations?.properties || []).some(p => p.name === "Size") && <option value="Size">Size</option>}
                              <option value="custom">Custom...</option>
                            </select>
                          )}
                        </div>

                        <div className="space-y-3">
                          {(editForm.variations?.properties || []).map((prop, propIdx) => (
                            <div key={prop.name} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 relative">
                              <button
                                type="button"
                                onClick={() => removeVariationProperty(propIdx)}
                                className="absolute top-2.5 right-2.5 text-[10px] text-red-500 hover:text-red-700 font-semibold"
                              >
                                Remove
                              </button>
                              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{prop.name}</div>
                              
                              <div>
                                <span className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Add Suggestions:</span>
                                <div className="flex flex-wrap gap-1 border border-zinc-150 dark:border-zinc-850 p-1.5 bg-zinc-55 dark:bg-zinc-950 mb-2">
                                  {(prop.name === "Color" ? ["Black", "White", "Red", "Blue", "Navy"] : ["S", "M", "L", "XL", "2XL", "3XL"])
                                    .filter(opt => !prop.options.includes(opt))
                                    .map(opt => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => updatePropertyOptions(propIdx, [...prop.options, opt])}
                                        className="text-[10px] bg-white dark:bg-zinc-900 hover:bg-blue-50 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-zinc-750 dark:text-zinc-300"
                                      >
                                        + {opt}
                                      </button>
                                    ))}
                                </div>
                              </div>

                              <div>
                                <span className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Add Custom Option (press Enter):</span>
                                <input
                                  type="text"
                                  placeholder="Type custom option name..."
                                  className="w-full px-2 py-1 text-xs rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const val = e.currentTarget.value.trim();
                                      if (val && !prop.options.includes(val)) {
                                        updatePropertyOptions(propIdx, [...prop.options, val]);
                                        e.currentTarget.value = "";
                                      }
                                    }
                                  }}
                                />
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {prop.options.map(opt => (
                                    <span key={opt} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 text-[11px]">
                                      {opt}
                                      <button 
                                        type="button" 
                                        onClick={() => updatePropertyOptions(propIdx, prop.options.filter(o => o !== opt))}
                                        className="hover:text-red-500 font-bold"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {(editForm.variations?.properties || []).length > 0 && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={generateMatrixCombinations}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-none uppercase tracking-wider"
                            >
                              Sync Variation Matrix
                            </button>
                          </div>
                        )}
                      </div>

                      {editForm.variations?.combinations && editForm.variations.combinations.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-350">
                            Variation Matrix Combinations ({editForm.variations.combinations.filter(c => c.isEnabled).length} active)
                          </label>
                          <div className="max-h-60 overflow-y-auto border border-zinc-200 dark:border-zinc-800">
                            <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-900">
                              <thead>
                                <tr className="bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                                  <th className="p-2 w-10 text-center">On</th>
                                  <th className="p-2 font-semibold">Variant Options</th>
                                  <th className="p-2 font-semibold w-24">Price (Rs)</th>
                                  <th className="p-2 font-semibold w-20">Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {editForm.variations?.combinations.map((comb, combIdx) => {
                                  const name = Object.keys(comb.values).map(k => comb.values[k]).join(" / ");
                                  return (
                                    <tr key={comb.id} className={"border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 " + (!comb.isEnabled ? "opacity-50 bg-zinc-50/20 dark:bg-zinc-900/20" : "")}>
                                      <td className="p-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={comb.isEnabled}
                                          onChange={(e) => {
                                            if (!editForm || !editForm.variations) return;
                                            const copy = { ...comb, isEnabled: e.target.checked };
                                            const combs = [...editForm.variations.combinations];
                                            combs[combIdx] = copy;
                                            setEditForm({
                                              ...editForm,
                                              variations: {
                                                properties: editForm.variations.properties,
                                                combinations: combs,
                                                priceOnProperty: editForm.variations.priceOnProperty,
                                                quantityOnProperty: editForm.variations.quantityOnProperty,
                                                skuOnProperty: editForm.variations.skuOnProperty
                                              }
                                            });
                                          }}
                                          className="w-3.5 h-3.5 text-blue-600 border-zinc-300 dark:border-zinc-700"
                                        />
                                      </td>
                                      <td className="p-2 font-medium">{name}</td>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={comb.price || ""}
                                          disabled={!comb.isEnabled}
                                          onChange={(e) => {
                                            if (!editForm || !editForm.variations) return;
                                            const combs = [...editForm.variations.combinations];
                                            combs[combIdx] = { ...comb, price: e.target.value };
                                            setEditForm({
                                              ...editForm,
                                              variations: {
                                                properties: editForm.variations.properties,
                                                combinations: combs,
                                                priceOnProperty: editForm.variations.priceOnProperty,
                                                quantityOnProperty: editForm.variations.quantityOnProperty,
                                                skuOnProperty: editForm.variations.skuOnProperty
                                              }
                                            });
                                          }}
                                          className="w-full px-1.5 py-0.5 border border-zinc-305 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={comb.quantity || ""}
                                          disabled={!comb.isEnabled}
                                          onChange={(e) => {
                                            if (!editForm || !editForm.variations) return;
                                            const combs = [...editForm.variations.combinations];
                                            combs[combIdx] = { ...comb, quantity: e.target.value };
                                            setEditForm({
                                              ...editForm,
                                              variations: {
                                                properties: editForm.variations.properties,
                                                combinations: combs,
                                                priceOnProperty: editForm.variations.priceOnProperty,
                                                quantityOnProperty: editForm.variations.quantityOnProperty,
                                                skuOnProperty: editForm.variations.skuOnProperty
                                              }
                                            });
                                          }}
                                          className="w-full px-1.5 py-0.5 border border-zinc-305 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Sticky Footer */}
                <div className="shrink-0 p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                  <div>
                    {selectedRowsCount > 0 ? (
                      <button 
                        onClick={handleApply}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-750 transition-colors shadow-sm rounded-none uppercase tracking-wider"
                      >
                        Apply to {selectedRowsCount} Selected Row(s)
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500 font-semibold select-none">Select rows in the grid to apply this preset</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold border border-blue-700 transition-colors shadow-sm rounded-none uppercase tracking-wider"
                    >
                      <Save size={13} /> Save Preset
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center text-zinc-400 dark:text-zinc-600 p-8 text-xs font-bold uppercase tracking-wider select-none">
                No Preset Selected. Create or select a preset to edit.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
