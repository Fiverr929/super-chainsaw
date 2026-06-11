"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Save, ChevronDown, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { ETSY_COLORS, ETSY_DIGITAL_CATEGORIES, ETSY_PHYSICAL_CATEGORIES, ETSY_WHEN_MADE, ETSY_SUBJECTS, ETSY_OCCASIONS, ETSY_CELEBRATIONS, categorySupportsOccasion, categorySupportsCelebration, categorySupportsSubject, ETSY_ORIENTATION, ETSY_FRAMING, ETSY_ASPECT_RATIO, ETSY_ROOM, ETSY_HOME_STYLE, ETSY_CAN_BE_PERSONALIZED, ETSY_SLEEVE_LENGTH, ETSY_NECKLINE, ETSY_CLOTHING_STYLE, ETSY_MUG_CAPACITY, categorySupportsGraphic, ETSY_GRAPHICS, ETSY_VARIATION_PROPERTY_DEFS } from "@/lib/etsyConstants";

export type VariationCombination = {
  id: string;
  values: Record<string, string>;
  price?: string;
  quantity?: string;
  skuTemplate?: string;
  imageSlot?: number;
  isEnabled: boolean;
};

export type VariationProperty = {
  name: string;
  propertyId: number;
  options: string[];
};

export type PresetVariations = {
  properties: VariationProperty[];
  combinations: VariationCombination[];
  priceOnProperty: string[];
  quantityOnProperty: string[];
  skuOnProperty: string[];
};

export type Preset = {
  primary_color?: string;
  secondary_color?: string;
  variations?: PresetVariations;
  id: string;
  name: string;
  category: string;
  section: string;
  price: string;
  quantity: string;
  context: string;
  who_made: string;
  when_made: string;
  is_supply: string;
  renewal_options: string;
  subject: string;
  occasion: string;
  celebration: string;
  shipping_profile?: string;
  readiness_state_id?: string;
  ai_title_rules: string;
  ai_desc_rules: string;
  ai_tag_rules: string;
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
  graphic?: string;
};

export const DEFAULT_PRESET: Preset = {
  id: "default-store-graphics",
  name: "Store Graphics Default",
  category: "Store Graphics",
  section: "",
  price: "3.99",
  quantity: "999",
  context: "This is a digital product.",
  who_made: "i_did",
  when_made: "2020_2026",
  is_supply: "false",
  renewal_options: "manual",
  primary_color: "Auto",
  secondary_color: "Auto",
  subject: "Auto",
  occasion: "Auto",
  celebration: "Auto",
  shipping_profile: "",
  variations: { properties: [], combinations: [], priceOnProperty: [], quantityOnProperty: [], skuOnProperty: [] },
  readiness_state_id: "",
  ai_title_rules: "MUST be exactly 140 characters or less including spaces",
  ai_desc_rules: "Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
  ai_tag_rules: "EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
};

export const DEFAULT_PHYSICAL_PRESET: Preset = {
  primary_color: "Auto",
  secondary_color: "Auto",
  id: "default-physical-preset",
  name: "Physical Listing Default",
  category: "",
  materials: "",
  sleeve_length: "Auto",
  neckline: "Auto",
  clothing_style: "Auto",
  capacity: "Auto",
  dishwasher_safe: "Auto",
  microwave_safe: "Auto",
  orientation: "Auto",
  framing: "Auto",
  aspect_ratio: "Auto",
  graphic: "Auto",
  section: "",
  price: "19.99",
  quantity: "100",
  context: "This is a physical product.",
  who_made: "i_did",
  when_made: "2020_2026",
  is_supply: "false",
  renewal_options: "manual",
  subject: "Auto",
  occasion: "Auto",
  celebration: "Auto",
  shipping_profile: "",
  variations: { properties: [], combinations: [], priceOnProperty: [], quantityOnProperty: [], skuOnProperty: [] },
  readiness_state_id: "",
  ai_title_rules: "MUST be exactly 140 characters or less including spaces",
  ai_desc_rules: "Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
  ai_tag_rules: "EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
};

interface PresetManagerModalProps {
  onClose: () => void;
  sheetType: 'digital' | 'physical';
}

export default function PresetManagerModal({ onClose, sheetType }: PresetManagerModalProps) {
  const [presets, setPresets] = useState<Preset[]>(() => {
    if (typeof window !== "undefined") {
      const key = sheetType === "digital" ? "workstation_v2_presets" : "workstation_v2_presets_physical";
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [sheetType === "digital" ? DEFAULT_PRESET : DEFAULT_PHYSICAL_PRESET];
        }
      }
    }
    return [sheetType === "digital" ? DEFAULT_PRESET : DEFAULT_PHYSICAL_PRESET];
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Preset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [sections, setSections] = useState<string[]>([""]);
  const [shippingProfiles, setShippingProfiles] = useState<string[]>([""]);
  const [processingProfiles, setProcessingProfiles] = useState<string[]>([""]);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
  const [isSubjectOpen, setIsSubjectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'core' | 'options' | 'attributes' | 'variations' | 'ai'>('core');

  const addVariationProperty = (name: string, propertyId: number) => {
    if (!editForm) return;
    const currentProps = editForm.variations?.properties || [];
    if (currentProps.length >= 2) {
      toast.error("You can add up to 2 variation properties.");
      return;
    }
    if (currentProps.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Property " + name + " is already added.");
      return;
    }
    const newProperty: VariationProperty = {
      name,
      propertyId,
      options: []
    };
    setEditForm({
      ...editForm,
      variations: {
        properties: [...currentProps, newProperty],
        combinations: editForm.variations?.combinations || [],
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

      const skuSuffix = optionValues.map((v: string) => v.toUpperCase().replace(/\s+/g, '')).join("-");
      return {
        id,
        values,
        isEnabled: true,
        skuTemplate: ""
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
    toast.success("Combinations synced. Don't forget to save the preset!");
  };

  const savePresets = (newPresets: Preset[]) => {
    setPresets(newPresets);
    const key = sheetType === "digital" ? "workstation_v2_presets" : "workstation_v2_presets_physical";
    localStorage.setItem(key, JSON.stringify(newPresets));
  };

  React.useEffect(() => {
     fetch('/api/etsy/sections')
       .then(res => res.json())
       .then(data => {
          if (data.sections && Array.isArray(data.sections)) {
             setSections(["", ...data.sections.map((s: { title: string }) => s.title)]);
          } else {
             setSections(["", "Comfort Colors 1717", "Gilden 5000", "Digital Prints"]);
          }
       })
       .catch(() => {
          setSections(["", "Comfort Colors 1717", "Gilden 5000", "Digital Prints"]);
       });

     if (sheetType === "physical") {
       fetch('/api/etsy/shipping-profiles')
         .then(res => res.json())
         .then(data => {
            if (data.profiles && Array.isArray(data.profiles)) {
               setShippingProfiles(["", ...data.profiles.map((p: { title: string }) => p.title)]);
            } else {
               setShippingProfiles(["", "Standard Shipping", "Express Shipping"]);
            }
         })
         .catch(() => {
            setShippingProfiles(["", "Standard Shipping", "Express Shipping"]);
         });

       fetch('/api/etsy/processing-profiles')
         .then(res => res.json())
         .then(data => {
            if (data.profiles && Array.isArray(data.profiles)) {
               setProcessingProfiles(["", ...data.profiles.map((p: { title: string }) => p.title)]);
            } else {
               setProcessingProfiles([""]);
            }
         })
         .catch(() => {
            setProcessingProfiles([""]);
         });
     }
  }, [sheetType]);

  const handleAddNew = () => {
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: "New Preset",
      category: "",
      section: "",
      price: sheetType === "digital" ? "3.99" : "19.99",
      quantity: sheetType === "digital" ? "999" : "100",
      context: "",
      who_made: "i_did",
      when_made: "2020_2026",
      is_supply: "false",
      renewal_options: "manual",
      subject: "Auto",
  occasion: "Auto",
  celebration: "Auto",
      shipping_profile: "",
      readiness_state_id: "",
      ai_title_rules: "MUST be exactly 140 characters or less including spaces",
      ai_desc_rules: "Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
      ai_tag_rules: "EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
      materials: "",
  sleeve_length: "Auto",
  neckline: "Auto",
  clothing_style: "Auto",
  capacity: "Auto",
  dishwasher_safe: "Auto",
  microwave_safe: "Auto",
  orientation: "Auto",
  framing: "Auto",
  aspect_ratio: "Auto",
  graphic: "Auto",
      variations: { properties: [], combinations: [], priceOnProperty: [], quantityOnProperty: [], skuOnProperty: [] },
    };
    
    // Immediately add the pill to the sidebar (top of the list)
    const newPresetsList = [newPreset, ...presets];
    setPresets(newPresetsList);
    
    setEditingId(newPreset.id);
    setEditForm(newPreset);
    setIsCreatingNew(true);
    setActiveTab('core');
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    
    if (!editForm.name.trim()) {
      toast.error("Preset name cannot be empty");
      return;
    }
    
    if (!editForm.price || !editForm.quantity) {
      toast.error("Price and Quantity are required");
      return;
    }

    const finalForm = { ...editForm };
    if (!categorySupportsOccasion(finalForm.category)) finalForm.occasion = "";
    if (!categorySupportsCelebration(finalForm.category)) finalForm.celebration = "";
    if (!categorySupportsSubject(finalForm.category)) finalForm.subject = "";
    if (!categorySupportsGraphic(finalForm.category)) finalForm.graphic = "";

    const existingIndex = presets.findIndex(p => p.id === finalForm.id);
    const newPresets = [...presets];
    
    if (existingIndex >= 0) {
      newPresets[existingIndex] = finalForm;
    } else {
      newPresets.push(finalForm);
    }
    
    savePresets(newPresets);
    setEditForm(finalForm);
    setIsCreatingNew(false);
    toast.success("Preset saved");
  };

  
  const handleDuplicate = (presetToCopy: Preset) => {
    const newPreset = { ...presetToCopy, id: Date.now().toString(), name: `${presetToCopy.name} (Copy)` };
    const newPresetsList = [newPreset, ...presets];
    setPresets(newPresetsList);
    setEditingId(newPreset.id);
    setEditForm(newPreset);
    setIsCreatingNew(true);
    setActiveTab('core');
  };

const handleDelete = (id: string) => {
    if (presets.length === 1) {
      toast.error("You must have at least one preset.");
      return;
    }
    const newPresets = presets.filter(p => p.id !== id);
    savePresets(newPresets);
    toast.success("Preset deleted");
    
    if (editingId === id) {
      setEditingId(newPresets[0].id);
      setEditForm({ ...newPresets[0] });
      setIsCreatingNew(false);
    }
  };

  const startEditing = (preset: Preset) => {
    // If abandoning an unsaved new preset, we could remove it here, but we will leave it for safety
    setEditingId(preset.id);
    setEditForm({ ...preset });
    setIsCreatingNew(false);
    setActiveTab('core');
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Listing Presets</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
            <X size={18} />
          </button>
        </div>

        {/* Content Area - Split View */}
        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Left Side: Preset List */}
          <div className="w-1/3 border-r border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-300 dark:border-zinc-700">
              <button 
                onClick={handleAddNew}
                disabled={editingId !== null && editForm?.name === "New Preset"}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
              >
                <Plus size={16} /> Create New Preset
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {presets.map(preset => (
                <div 
                  key={preset.id}
                  className={`group flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer ${
                    editingId === preset.id 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' 
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                  onClick={() => { if (editingId !== preset.id) startEditing(preset) }}
                >
                  <div className="overflow-hidden">
                    <h4 className={`text-sm font-medium truncate ${editingId === preset.id ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {preset.name}
                    </h4>
                    <p className="text-xs text-zinc-500 truncate">
                      {preset.category} • ${preset.price}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 pl-2 ${editingId === preset.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(preset); }}
                      className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      title="Duplicate Preset"
                    >
                      <Copy size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
                      className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      title="Delete Preset"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Editor */}
          <div className="w-2/3 bg-white dark:bg-zinc-950 p-6 overflow-y-auto">
            {editingId && editForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                    {isCreatingNew ? 'Create New Preset' : 'Edit Preset'}
                  </h3>
                  <button 
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium border border-blue-700"
                  >
                    <Save size={14} /> {isCreatingNew ? 'Create Preset' : 'Save Changes'}
                  </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 overflow-x-auto select-none gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('core')}
                    className={`pb-2 px-3 border-b-2 transition-all duration-155 -mb-[2px] ${
                      activeTab === 'core'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Core Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('options')}
                    className={`pb-2 px-3 border-b-2 transition-all duration-155 -mb-[2px] ${
                      activeTab === 'options'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Etsy Options
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('attributes')}
                    className={`pb-2 px-3 border-b-2 transition-all duration-155 -mb-[2px] ${
                      activeTab === 'attributes'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    Attributes
                  </button>
                  {sheetType === "physical" && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('variations')}
                      className={`pb-2 px-3 border-b-2 transition-all duration-155 -mb-[2px] ${
                        activeTab === 'variations'
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                          : 'border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      Variations Matrix
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai')}
                    className={`pb-2 px-3 border-b-2 transition-all duration-155 -mb-[2px] ${
                      activeTab === 'ai'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-transparent hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    AI Rules
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'core' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Preset Name <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="e.g., Minimalist Wall Art"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Default Category <span className="text-red-500">*</span>
                        </label>
                        <select 
                          value={editForm.category}
                          onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="">Select Category...</option>
                          {(sheetType === "digital" ? ETSY_DIGITAL_CATEGORIES : ETSY_PHYSICAL_CATEGORIES).filter(Boolean).map(cat => <option key={cat} value={cat} className={cat === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{cat}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Default Section</label>
                        <select 
                          value={editForm.section}
                          onChange={e => setEditForm({ ...editForm, section: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="">Select Section...</option>
                          {sections.map(sec => <option key={sec} value={sec} className={sec === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{sec}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Default Price ($) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-zinc-400 text-sm">$</span>
                          </div>
                          <input 
                            type="number"
                            step="0.01" 
                            value={editForm.price}
                            onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="5.99"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Default Quantity <span className="text-red-500">*</span>
                        </label>
                        <input 
                          type="number" 
                          value={editForm.quantity}
                          onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          placeholder="999"
                        />
                      </div>
                    </div>

                    {sheetType === "physical" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Default Shipping Profile
                          </label>
                          <select
                            value={editForm.shipping_profile || ""}
                            onChange={e => setEditForm({ ...editForm, shipping_profile: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            {shippingProfiles.map(prof => (
                              <option key={prof} value={prof}>
                                {prof || "None"}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Default Processing Profile
                          </label>
                          <select
                            value={editForm.readiness_state_id || ""}
                            onChange={e => setEditForm({ ...editForm, readiness_state_id: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            {processingProfiles.map(prof => (
                              <option key={prof} value={prof}>
                                {prof || "None"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'options' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Who made it? <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editForm.who_made}
                          onChange={e => setEditForm({ ...editForm, who_made: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="i_did">I did</option>
                          <option value="someone_else">Someone else</option>
                          <option value="collective">A collective</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          When was it made? <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editForm.when_made}
                          onChange={e => setEditForm({ ...editForm, when_made: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          {ETSY_WHEN_MADE.map(when => {
                            let label = when;
                            if (when === "made_to_order") label = "Made to order";
                            else if (when.startsWith("before_")) label = "Before " + when.split("_")[1];
                            else if (when.includes("_")) label = when.replace("_", " - ");
                            
                            return (
                              <option key={when} value={when}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          What is it? <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editForm.is_supply}
                          onChange={e => setEditForm({ ...editForm, is_supply: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="false">A finished product</option>
                          <option value="true">A supply or tool to make things</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Renewal Options <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={editForm.renewal_options}
                          onChange={e => setEditForm({ ...editForm, renewal_options: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="automatic">Automatic</option>
                          <option value="manual">Manual</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'attributes' && (
                  <div className="space-y-4">
                    {/* General Colors */}
                    <div className="border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900/10 rounded-none space-y-3">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">General Attributes</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Primary Color</label>
                          <select
                            value={editForm.primary_color || "Auto"}
                            onChange={e => setEditForm({ ...editForm, primary_color: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            {ETSY_COLORS.map(c => (
                              <option key={c} value={c} className={c === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Secondary Color</label>
                          <select
                            value={editForm.secondary_color || "Auto"}
                            onChange={e => setEditForm({ ...editForm, secondary_color: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            {ETSY_COLORS.map(c => (
                              <option key={c} value={c} className={c === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Occasion & Celebration */}
                    <div className="grid grid-cols-2 gap-4">
                      {categorySupportsOccasion(editForm.category) && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Occasion</label>
                          <select
                            value={editForm.occasion}
                            onChange={e => setEditForm({ ...editForm, occasion: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            {ETSY_OCCASIONS.filter(Boolean).map(occ => (
                              <option key={occ} value={occ} className={occ === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{occ}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {categorySupportsCelebration(editForm.category) && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Celebration / Holiday</label>
                          <select
                            value={editForm.celebration}
                            onChange={e => setEditForm({ ...editForm, celebration: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            {ETSY_CELEBRATIONS.filter(Boolean).map(cel => (
                              <option key={cel} value={cel} className={cel === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{cel}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {categorySupportsSubject(editForm.category) && (
                      <div className="relative">
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Subject (Art Only - Max 3)</label>
                        <div 
                          onClick={() => setIsSubjectOpen(!isSubjectOpen)}
                          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex justify-between items-center cursor-pointer min-h-[38px] select-none"
                        >
                          <span className="truncate">
                            {editForm.subject || "Select subjects..."}
                          </span>
                          <ChevronDown size={14} className="text-zinc-500" />
                        </div>
                        
                        {isSubjectOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsSubjectOpen(false)} />
                            <div className="absolute left-0 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-750 shadow-lg z-20 max-h-60 overflow-y-auto p-2 space-y-1">
                              {ETSY_SUBJECTS.filter(Boolean).map(sub => {
                                const selectedList = (editForm.subject || "").split(",").map(s => s.trim()).filter(Boolean);
                                const isChecked = selectedList.includes(sub);
                                
                                const toggleSubject = () => {
                                  let newList = [...selectedList];
                                  if (isChecked) {
                                    newList = newList.filter(s => s !== sub);
                                  } else {
                                    if (newList.length >= 3) {
                                      toast.error("You can select up to 3 subjects.");
                                      return;
                                    }
                                    newList.push(sub);
                                  }
                                  setEditForm({ ...editForm, subject: newList.join(", ") });
                                };

                                return (
                                  <label key={sub} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm text-zinc-800 dark:text-zinc-200 select-none">
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={toggleSubject}
                                      className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                                    />
                                    {sub}
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {categorySupportsGraphic(editForm.category) && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Graphic</label>
                        <select
                          value={editForm.graphic || ""}
                          onChange={e => setEditForm({ ...editForm, graphic: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          {ETSY_GRAPHICS.filter(Boolean).map(gr => (
                            <option key={gr} value={gr} className={gr === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{gr}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Materials � visible on both physical and digital sheets */}
                    <div className="relative">
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Materials</label>
                      <div 
                        onClick={() => setIsMaterialsOpen(!isMaterialsOpen)}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex justify-between items-center cursor-pointer min-h-[38px] select-none"
                      >
                        <span className="truncate">
                          {editForm.materials || "Select materials..."}
                        </span>
                        <ChevronDown size={14} className="text-zinc-500" />
                      </div>
                      
                      {isMaterialsOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsMaterialsOpen(false)} />
                          <div className="absolute left-0 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-750 shadow-lg z-20 max-h-60 overflow-y-auto p-2 space-y-1">
                            {["Cotton", "Polyester", "Ceramic", "Paper", "Canvas", "Wood", "Metal", "Glass", "Enamel", "Plastic", "Vinyl", "Leather"].map(mat => {
                              const selectedList = (editForm.materials || "").split(",").map(s => s.trim()).filter(Boolean);
                              const isChecked = selectedList.includes(mat);
                              
                              const toggleMaterial = () => {
                                let newList = [...selectedList];
                                if (isChecked) {
                                  newList = newList.filter(m => m !== mat);
                                } else {
                                  newList.push(mat);
                                }
                                setEditForm({ ...editForm, materials: newList.join(", ") });
                              };

                              return (
                                <label key={mat} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm text-zinc-800 dark:text-zinc-200 select-none">
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={toggleMaterial}
                                    className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                                  />
                                  {mat}
                                </label>
                              );
                            })}
                            
                            <div className="border-t border-zinc-200 dark:border-zinc-800 mt-2 pt-2">
                              <label className="block text-[10px] font-bold uppercase text-zinc-405 mb-1 px-2">Custom Material</label>
                              <input
                                type="text"
                                placeholder="Add custom, comma-separated..."
                                value={editForm.materials || ""}
                                onChange={e => setEditForm({ ...editForm, materials: e.target.value })}
                                className="w-full px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {sheetType === "physical" && (
                      <div className="border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-850 rounded-none space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Physical-only attributes</h4>

                        {/* Category-specific fields */}
                        {(editForm.category === "T-Shirts" || editForm.category === "Sweatshirts & Hoodies") && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Sleeve Length</label>
                              <select
                                value={editForm.sleeve_length || ""}
                                onChange={e => setEditForm({ ...editForm, sleeve_length: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                {ETSY_SLEEVE_LENGTH.map(sl => (
                                  <option key={sl} value={sl} className={sl === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{sl}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Neckline</label>
                              <select
                                value={editForm.neckline || ""}
                                onChange={e => setEditForm({ ...editForm, neckline: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                {ETSY_NECKLINE.map(nl => (
                                  <option key={nl} value={nl} className={nl === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{nl}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Clothing Style</label>
                              <select
                                value={editForm.clothing_style || ""}
                                onChange={e => setEditForm({ ...editForm, clothing_style: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                {ETSY_CLOTHING_STYLE.map(st => (
                                  <option key={st} value={st} className={st === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{st}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {editForm.category === "Mugs & Drinkware" && (
                          <div className="grid grid-cols-3 gap-3 pt-2">
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Capacity</label>
                              <select
                                value={editForm.capacity || ""}
                                onChange={e => setEditForm({ ...editForm, capacity: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                {ETSY_MUG_CAPACITY.map(cap => (
                                  <option key={cap} value={cap} className={cap === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{cap}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Dishwasher Safe</label>
                              <select
                                value={editForm.dishwasher_safe || ""}
                                onChange={e => setEditForm({ ...editForm, dishwasher_safe: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                <option value="">Select...</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Microwave Safe</label>
                              <select
                                value={editForm.microwave_safe || ""}
                                onChange={e => setEditForm({ ...editForm, microwave_safe: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                <option value="">Select...</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {editForm.category === "Posters & Prints" && (
                          <div className="grid grid-cols-3 gap-3 pt-2">
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Orientation</label>
                              <select
                                value={editForm.orientation || ""}
                                onChange={e => setEditForm({ ...editForm, orientation: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                {ETSY_ORIENTATION.map(or => (
                                  <option key={or} value={or} className={or === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{or}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Framing</label>
                              <select
                                value={editForm.framing || ""}
                                onChange={e => setEditForm({ ...editForm, framing: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                {ETSY_FRAMING.map(fr => (
                                  <option key={fr} value={fr} className={fr === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{fr}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Aspect Ratio</label>
                              <select
                                value={editForm.aspect_ratio || ""}
                                onChange={e => setEditForm({ ...editForm, aspect_ratio: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                              >
                                {ETSY_ASPECT_RATIO.map(ar => (
                                  <option key={ar} value={ar} className={ar === "Auto" ? "bg-blue-100 text-blue-800 font-medium" : ""}>{ar}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'variations' && sheetType === 'physical' && (
                  <div className="space-y-4">
                    {/* Variations Properties Addition and Config */}
                    <div className="border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-850 rounded-none space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-2">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Variation Properties</h4>
                        {(!editForm.variations?.properties || editForm.variations.properties.length < 2) && (
                          <select
                            className="text-xs px-2 py-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                            onChange={(e) => {
                              if (e.target.value === "custom") {
                                const name = prompt("Enter custom variation property name (e.g. Size, Color, Capacity, Style, Material, Paper):");
                                if (name) {
                                  addVariationProperty(name, 0);
                                }
                              } else if (e.target.value) {
                                const parts = e.target.value.split(":");
                                addVariationProperty(parts[0], parseInt(parts[1]));
                              }
                              e.target.value = "";
                            }}
                          >
                            <option value="">+ Add Variation Property...</option>
                            {(() => {
                              const standardDefs = ETSY_VARIATION_PROPERTY_DEFS[editForm.category] || [];
                              const currentNames = (editForm.variations?.properties || []).map(p => p.name.toLowerCase());
                              return standardDefs
                                .filter(def => !currentNames.includes(def.name.toLowerCase()))
                                .map(def => (
                                  <option key={def.name} value={def.name + ":" + def.propertyId}>
                                    {def.name} (Standard)
                                  </option>
                                ));
                            })()}
                            <option value="custom">Custom Property...</option>
                          </select>
                        )}
                      </div>

                      {/* Configured properties list */}
                      <div className="space-y-3">
                        {(editForm.variations?.properties || []).map((prop, propIdx) => {
                          const standardDef = (ETSY_VARIATION_PROPERTY_DEFS[editForm.category] || [])
                            .find(def => def.name.toLowerCase() === prop.name.toLowerCase());
                          const allowedSuggestions = standardDef ? standardDef.options : [];

                          return (
                            <div key={prop.name} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 relative">
                              <button
                                type="button"
                                onClick={() => removeVariationProperty(propIdx)}
                                className="absolute top-2.5 right-2.5 text-[11px] text-red-500 hover:text-red-755 font-semibold"
                                title="Remove property"
                              >
                                Remove
                              </button>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-350">{prop.name}</span>
                                <span className="text-[10px] text-zinc-400">ID: {prop.propertyId || "Custom"}</span>
                              </div>

                              {/* Standard Suggestions Checkboxes */}
                              {allowedSuggestions.length > 0 && (
                                <div className="space-y-1">
                                  <span className="block text-[10px] font-bold uppercase text-zinc-400">Standard Options:</span>
                                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto border border-zinc-100 dark:border-zinc-805 p-1.5 bg-zinc-50 dark:bg-zinc-950">
                                    {allowedSuggestions.map(opt => {
                                      const isChecked = prop.options.includes(opt);
                                      const toggleOpt = () => {
                                        let newOpts = [...prop.options];
                                        if (isChecked) {
                                          newOpts = newOpts.filter(o => o !== opt);
                                        } else {
                                          newOpts.push(opt);
                                        }
                                        updatePropertyOptions(propIdx, newOpts);
                                      };
                                      return (
                                        <label key={opt} className="flex items-center gap-1 text-[11px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 px-1.5 py-0.5 rounded cursor-pointer select-none">
                                          <input 
                                            type="checkbox" 
                                            checked={isChecked}
                                            onChange={toggleOpt}
                                            className="w-3.5 h-3.5 rounded text-blue-600 border-zinc-300 dark:border-zinc-700 focus:ring-blue-500"
                                          />
                                          {opt}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Custom input options */}
                              <div>
                                <span className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Custom Option:</span>
                                <input
                                  type="text"
                                  placeholder="Type option name and press Enter..."
                                  className="w-full px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none"
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
                                <div className="flex flex-wrap gap-1 mt-1.5">
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
                          );
                        })}
                      </div>

                      {/* Generate Button */}
                      {(editForm.variations?.properties || []).length > 0 && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={generateMatrixCombinations}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-none"
                          >
                            Generate / Sync Variation Matrix
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Variations Matrix Table */}
                    {editForm.variations?.combinations && editForm.variations.combinations.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Variation Matrix Combinations ({editForm.variations.combinations.filter(c => c.isEnabled).length} active)
                        </label>
                        <div className="max-h-80 overflow-y-auto border border-zinc-200 dark:border-zinc-800">
                          <table className="w-full text-left text-xs border-collapse bg-white dark:bg-zinc-900">
                            <thead>
                              <tr className="bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                                <th className="p-2 w-10 text-center">On</th>
                                <th className="p-2 font-semibold">Variant Options</th>
                                <th className="p-2 font-semibold w-24">Price ($)</th>
                                <th className="p-2 font-semibold w-20">Quantity</th>
                                <th className="p-2 font-semibold w-36">SKU Template</th>
                                <th className="p-2 font-semibold w-28">Image Slot</th>
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
                                        placeholder={editForm.price || "19.99"}
                                        value={comb.price || ""}
                                        disabled={!comb.isEnabled}
                                        onChange={(e) => {
                                          if (!editForm || !editForm.variations) return;
                                          const val = e.target.value.replace(/[^0-9.]/g, '');
                                          const combs = [...editForm.variations.combinations];
                                          combs[combIdx] = { ...comb, price: val };
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
                                        className="w-full px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        placeholder={editForm.quantity || "100"}
                                        value={comb.quantity || ""}
                                        disabled={!comb.isEnabled}
                                        onChange={(e) => {
                                          if (!editForm || !editForm.variations) return;
                                          const val = e.target.value.replace(/[^0-9]/g, '');
                                          const combs = [...editForm.variations.combinations];
                                          combs[combIdx] = { ...comb, quantity: val };
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
                                        className="w-full px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        placeholder="{folder}-variant"
                                        value={comb.skuTemplate || ""}
                                        disabled={!comb.isEnabled}
                                        onChange={(e) => {
                                          if (!editForm || !editForm.variations) return;
                                          const combs = [...editForm.variations.combinations];
                                          combs[combIdx] = { ...comb, skuTemplate: e.target.value };
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
                                        className="w-full px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <select
                                        value={comb.imageSlot || ""}
                                        disabled={!comb.isEnabled}
                                        onChange={(e) => {
                                          if (!editForm || !editForm.variations) return;
                                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                                          const combs = [...editForm.variations.combinations];
                                          combs[combIdx] = { ...comb, imageSlot: val };
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
                                        className="w-full px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                                      >
                                        <option value="">None</option>
                                        {Array.from({ length: 10 }).map((_, i) => (
                                          <option key={i} value={i + 1}>Image {i + 1}</option>
                                        ))}
                                      </select>
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

                {activeTab === 'ai' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">AI Prompt Context (Rules)</label>
                      <textarea 
                        value={editForm.context}
                        onChange={e => setEditForm({ ...editForm, context: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[120px] resize-y"
                        placeholder="Enter any default AI instructions, SEO rules, or material descriptions for this preset..."
                      />
                      <p className="text-[11px] text-zinc-500 mt-1.5">
                        This text is injected into the Context column for any listing using this preset.
                      </p>
                    </div>

                    <details className="group border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900" open>
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none hover:bg-zinc-50 dark:hover:bg-zinc-800 list-none flex justify-between items-center">
                        Advanced AI Rules
                        <span className="text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title Rule</label>
                          <textarea 
                            value={editForm.ai_title_rules || DEFAULT_PRESET.ai_title_rules}
                            onChange={e => setEditForm({ ...editForm, ai_title_rules: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description Rule</label>
                          <textarea 
                            value={editForm.ai_desc_rules || DEFAULT_PRESET.ai_desc_rules}
                            onChange={e => setEditForm({ ...editForm, ai_desc_rules: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px] resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tag Rule</label>
                          <textarea 
                            value={editForm.ai_tag_rules || DEFAULT_PRESET.ai_tag_rules}
                            onChange={e => setEditForm({ ...editForm, ai_tag_rules: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] resize-y"
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                <h3 className="text-base font-medium text-zinc-700 dark:text-zinc-300 mb-1">No Preset Selected</h3>
                <p className="text-sm text-center max-w-[250px]">Select a preset from the sidebar to edit its default values, or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


