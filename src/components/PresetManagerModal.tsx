"use client";

import React, { useState } from"react";
import { X, Plus, Trash2, Save, ChevronDown, Copy } from"lucide-react";
import toast from"react-hot-toast";
import { ETSY_COLORS, ETSY_DIGITAL_CATEGORIES, ETSY_PHYSICAL_CATEGORIES, ETSY_WHEN_MADE, ETSY_SUBJECTS, ETSY_OCCASIONS, ETSY_CELEBRATIONS, categorySupportsOccasion, categorySupportsCelebration, categorySupportsSubject, ETSY_ORIENTATION, ETSY_FRAMING, ETSY_ASPECT_RATIO, ETSY_SLEEVE_LENGTH, ETSY_NECKLINE, ETSY_CLOTHING_STYLE, ETSY_MUG_CAPACITY, categorySupportsGraphic, ETSY_GRAPHICS, ETSY_VARIATION_PROPERTY_DEFS } from"@/lib/etsyConstants";

export type VariationCombination = {
 id: string;
 values: Record<string, string>;
 price?: string;
 quantity?: string;
 skuTemplate?: string;
 imageSlot?: number;
 isEnabled: boolean;
 maximum_retail_price?: string;
 minimum_seller_allowed_price?: string;
 maximum_seller_allowed_price?: string;
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
 enable_pod?: boolean;
 pod_blueprint_id?: number;
 pod_print_provider_id?: number;
 pod_position?: string;
};

export const PREDEFINED_BLUEPRINTS = [
 { id: 12, name:"Unisex Heavy Cotton Tee (Gildan 5000)"},
 { id: 10, name:"Unisex Heavy Blend Crewneck Sweatshirt (Gildan 18000)"},
 { id: 144, name:"Unisex Heavy Blend Hooded Sweatshirt (Gildan 18500)"},
 { id: 9, name:"Unisex Jersey Short Sleeve Tee (Bella+Canvas 3001)"}
];

export const PRINT_PROVIDERS = [
 { id: 99, name:"Monster Digital"},
 { id: 16, name:"SwiftPOD"},
 { id: 29, name:"Printify Choice"},
 { id: 26, name:"Awkward Styles"},
 { id: 3, name:"Dimona Tee"},
 { id: 39, name:"MyLocker"},
 { id: 10, name:"Print Geek"}
];

export const DEFAULT_PRESET: Preset = {
 id:"default-store-graphics",
 name:"Store Graphics Default",
 category:"Store Graphics",
 section:"",
 price:"3.99",
 quantity:"999",
 context:"This is a digital product.",
 who_made:"i_did",
 when_made:"2020_2026",
 is_supply:"false",
 renewal_options:"manual",
 primary_color:"Auto",
 secondary_color:"Auto",
 subject:"Auto",
 occasion:"Auto",
 celebration:"Auto",
 shipping_profile:"",
 variations: { properties: [], combinations: [], priceOnProperty: [], quantityOnProperty: [], skuOnProperty: [] },
 readiness_state_id:"",
 ai_title_rules:"MUST be exactly 140 characters or less including spaces",
 ai_desc_rules:"Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
 ai_tag_rules:"EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
};

export const DEFAULT_PHYSICAL_PRESET: Preset = {
 primary_color:"Auto",
 secondary_color:"Auto",
 id:"default-physical-preset",
 name:"Physical Listing Default",
 category:"",
 materials:"",
 sleeve_length:"Auto",
 neckline:"Auto",
 clothing_style:"Auto",
 capacity:"Auto",
 dishwasher_safe:"Auto",
 microwave_safe:"Auto",
 orientation:"Auto",
 framing:"Auto",
 aspect_ratio:"Auto",
 graphic:"Auto",
 section:"",
 price:"19.99",
 quantity:"100",
 context:"This is a physical product.",
 who_made:"i_did",
 when_made:"2020_2026",
 is_supply:"false",
 renewal_options:"manual",
 subject:"Auto",
 occasion:"Auto",
 celebration:"Auto",
 shipping_profile:"",
 variations: { properties: [], combinations: [], priceOnProperty: [], quantityOnProperty: [], skuOnProperty: [] },
 readiness_state_id:"",
 ai_title_rules:"MUST be exactly 140 characters or less including spaces",
 ai_desc_rules:"Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
 ai_tag_rules:"EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
 enable_pod: false,
};

interface PresetManagerModalProps {
 onClose: () => void;
 sheetType:'digital'|'physical';
}

export default function PresetManagerModal({ onClose, sheetType }: PresetManagerModalProps) {
 const [presets, setPresets] = useState<Preset[]>(() => {
 if (typeof window !=="undefined") {
 const key = sheetType ==="digital"?"workstation_v2_presets":"workstation_v2_presets_physical";
 const saved = localStorage.getItem(key);
 if (saved) {
 try {
 return JSON.parse(saved);
 } catch {
 return [sheetType ==="digital"? DEFAULT_PRESET : DEFAULT_PHYSICAL_PRESET];
 }
 }
 }
 return [sheetType ==="digital"? DEFAULT_PRESET : DEFAULT_PHYSICAL_PRESET];
 });
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editForm, setEditForm] = useState<Preset | null>(null);
 const [isCreatingNew, setIsCreatingNew] = useState(false);
 const [sections, setSections] = useState<string[]>([""]);
 const [shippingProfiles, setShippingProfiles] = useState<string[]>([""]);
 const [processingProfiles, setProcessingProfiles] = useState<string[]>([""]);
 const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);
 const [isSubjectOpen, setIsSubjectOpen] = useState(false);
 const [activeTab, setActiveTab] = useState<'core'|'options'|'attributes'|'variations'|'ai'|'pod'>('core');

 const addVariationProperty = (name: string, propertyId: number) => {
 if (!editForm) return;
 const currentProps = editForm.variations?.properties || [];
 if (currentProps.length >= 2) {
 toast.error("You can add up to 2 variation properties.");
 return;
 }
 if (currentProps.some(p => p.name.toLowerCase() === name.toLowerCase())) {
 toast.error("Property"+ name +"is already added.");
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
 return {
 id,
 values,
 isEnabled: true,
 skuTemplate:""
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
 const key = sheetType ==="digital"?"workstation_v2_presets":"workstation_v2_presets_physical";
 localStorage.setItem(key, JSON.stringify(newPresets));
 };

 React.useEffect(() => {
 fetch('/api/etsy/sections')
 .then(res => res.json())
 .then(data => {
 if (data.sections && Array.isArray(data.sections)) {
 setSections(["", ...data.sections.map((s: { title: string }) => s.title)]);
 } else {
 setSections(["","Comfort Colors 1717","Gilden 5000","Digital Prints"]);
 }
 })
 .catch(() => {
 setSections(["","Comfort Colors 1717","Gilden 5000","Digital Prints"]);
 });

 if (sheetType ==="physical") {
 fetch('/api/etsy/shipping-profiles')
 .then(res => res.json())
 .then(data => {
 if (data.profiles && Array.isArray(data.profiles)) {
 setShippingProfiles(["", ...data.profiles.map((p: { title: string }) => p.title)]);
 } else {
 setShippingProfiles(["","Standard Shipping","Express Shipping"]);
 }
 })
 .catch(() => {
 setShippingProfiles(["","Standard Shipping","Express Shipping"]);
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
 name:"New Preset",
 category:"",
 section:"",
 price: sheetType ==="digital"?"3.99":"19.99",
 quantity: sheetType ==="digital"?"999":"100",
 context:"",
 who_made:"i_did",
 when_made:"2020_2026",
 is_supply:"false",
 renewal_options:"manual",
 subject:"Auto",
 occasion:"Auto",
 celebration:"Auto",
 shipping_profile:"",
 readiness_state_id:"",
 ai_title_rules:"MUST be exactly 140 characters or less including spaces",
 ai_desc_rules:"Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
 ai_tag_rules:"EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
 materials:"",
 sleeve_length:"Auto",
 neckline:"Auto",
 clothing_style:"Auto",
 capacity:"Auto",
 dishwasher_safe:"Auto",
 microwave_safe:"Auto",
 orientation:"Auto",
 framing:"Auto",
 aspect_ratio:"Auto",
 graphic:"Auto",
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
 if (!categorySupportsOccasion(finalForm.category)) finalForm.occasion ="";
 if (!categorySupportsCelebration(finalForm.category)) finalForm.celebration ="";
 if (!categorySupportsSubject(finalForm.category)) finalForm.subject ="";
 if (!categorySupportsGraphic(finalForm.category)) finalForm.graphic ="";

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
 const newPreset = { ...presetToCopy, id: Date.now().toString(), name:`${presetToCopy.name} (Copy)`};
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

 const hasUnsavedChanges = () => {
 if (!editingId || !editForm) return false;
 const savedPresets = JSON.parse(localStorage.getItem(sheetType ==="digital"?"workstation_v2_presets":"workstation_v2_presets_physical") ||"[]");
 const original = savedPresets.find((p: Preset) => p.id === editingId);
 if (!original) return true; // New or duplicated preset
 return JSON.stringify(original) !== JSON.stringify(editForm);
 };

 const attemptNavigation = () => {
 if (hasUnsavedChanges()) {
 if (!confirm("You have unsaved changes. Discard them?")) return false;
 // Prune ghost preset if it was never saved
 const savedPresets = JSON.parse(localStorage.getItem(sheetType ==="digital"?"workstation_v2_presets":"workstation_v2_presets_physical") ||"[]");
 if (!savedPresets.some((p: Preset) => p.id === editingId)) {
 setPresets(prev => prev.filter(p => p.id !== editingId));
 }
 }
 return true;
 };

 const handleClose = (e: React.MouseEvent) => {
 e.stopPropagation();
 if (attemptNavigation()) {
 onClose();
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
 <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/50 p-4"onClick={handleClose}>
 <div className="bg-white border border-zinc-300 w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl"style={{ height:"80vh", minHeight:"600px", maxHeight:"850px"}} onClick={e => e.stopPropagation()}>
 
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-zinc-300 bg-zinc-50">
 <h2 className="text-base font-semibold text-zinc-800">Listing Presets</h2>
 <button onClick={handleClose} className="p-1 hover:bg-zinc-200 text-zinc-500">
 <X size={18} />
 </button>
 </div>

 {/* Content Area - Split View */}
 <div className="flex flex-1 overflow-hidden min-h-0">
 {/* Left Side: Preset List */}
 <div className="w-1/3 border-r border-zinc-300 bg-zinc-50 flex flex-col overflow-hidden">
 <div className="p-3 border-b border-zinc-300">
 <button 
 onClick={handleAddNew}
 disabled={editingId !== null && editForm?.name ==="New Preset"}
 className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-100 disabled:opacity-50"
 >
 <Plus size={16} /> Create New Preset
 </button>
 </div>
 
 <div className="flex-1 overflow-y-auto">
 {presets.map(preset => (
 <div 
 key={preset.id}
 className={`group flex items-center justify-between p-3 border-b border-zinc-200 cursor-pointer ${
 editingId === preset.id 
 ?'bg-blue-50 border-l-2 border-l-blue-500'
 :'hover:bg-zinc-100'
 }`}
 onClick={() => { if (editingId !== preset.id) startEditing(preset) }}
 >
 <div className="overflow-hidden">
 <h4 className={`text-sm font-medium truncate ${editingId === preset.id ?'text-blue-700':'text-zinc-800'}`}>
 {preset.name}
 </h4>
 <p className="text-xs text-zinc-500 truncate">
 {preset.category} • ${preset.price}
 </p>
 </div>
 <div className={`flex items-center gap-1 pl-2 ${editingId === preset.id ?'opacity-100':'opacity-0 group-hover:opacity-100'}`}>
 <button 
 onClick={(e) => { e.stopPropagation(); handleDuplicate(preset); }}
 className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-zinc-200"
 title="Duplicate Preset"
 >
 <Copy size={14} />
 </button>
 <button 
 onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
 className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-200"
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
 <div className="w-2/3 bg-white flex flex-col h-full relative min-h-0">
 {editingId && editForm ? (
 <div className="flex flex-col h-full min-h-0">
 {/* Header/Tabs */}
 <div className="flex border-b border-zinc-300 bg-zinc-50 shrink-0 select-none overflow-x-auto">
 <button
 type="button"
 onClick={() => setActiveTab('core')}
 className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-colors ${
 activeTab ==='core'
 ?'bg-white text-blue-600 border-b-2 border-b-blue-500 font-bold'
 :'text-zinc-500 hover:bg-zinc-100'
 }`}
 >
 Core Details
 </button>
 <button
 type="button"
 onClick={() => setActiveTab('options')}
 className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-colors ${
 activeTab ==='options'
 ?'bg-white text-blue-600 border-b-2 border-b-blue-500 font-bold'
 :'text-zinc-500 hover:bg-zinc-100'
 }`}
 >
 Etsy Options
 </button>
 <button
 type="button"
 onClick={() => setActiveTab('attributes')}
 className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-colors ${
 activeTab ==='attributes'
 ?'bg-white text-blue-600 border-b-2 border-b-blue-500 font-bold'
 :'text-zinc-500 hover:bg-zinc-100'
 }`}
 >
 Attributes
 </button>
 {sheetType ==="physical"&& (
 <button
 type="button"
 onClick={() => setActiveTab('variations')}
 className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-colors ${
 activeTab ==='variations'
 ?'bg-white text-blue-600 border-b-2 border-b-blue-500 font-bold'
 :'text-zinc-500 hover:bg-zinc-100'
 }`}
 >
 Variations Matrix
 </button>
 )}
 <button
 type="button"
 onClick={() => setActiveTab('ai')}
 className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-colors ${
 activeTab ==='ai'
 ?'bg-white text-blue-600 border-b-2 border-b-blue-500 font-bold'
 :'text-zinc-500 hover:bg-zinc-100'
 }`}
 >
 AI Rules
 </button>
 {sheetType ==="physical"&& (
 <button
 type="button"
 onClick={() => setActiveTab('pod')}
 className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider transition-colors ${
 activeTab ==='pod'
 ?'bg-white text-blue-600 border-b-2 border-b-blue-500 font-bold'
 :'text-zinc-500 hover:bg-zinc-100'
 }`}
 >
 Printify POD
 </button>
 )}
 </div>
 
 {/* Scrollable Content */}
 <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar space-y-4">
 {/* Tab Content */}
 {activeTab ==='core'&& (
 <div className="space-y-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Preset Name <span className="text-red-500">*</span>
 </label>
 <input 
 type="text"
 value={editForm.name}
 onChange={e => setEditForm({ ...editForm, name: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 placeholder="e.g., Minimalist Wall Art"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Default Category <span className="text-red-500">*</span>
 </label>
 <select 
 value={editForm.category}
 onChange={e => setEditForm({ ...editForm, category: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="">Select Category...</option>
 {(sheetType ==="digital"? ETSY_DIGITAL_CATEGORIES : ETSY_PHYSICAL_CATEGORIES).filter(Boolean).map(cat => <option key={cat} value={cat} className={cat ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{cat}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Default Section</label>
 <select 
 value={editForm.section}
 onChange={e => setEditForm({ ...editForm, section: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="">Select Section...</option>
 {sections.map(sec => <option key={sec} value={sec} className={sec ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{sec}</option>)}
 </select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
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
 className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 placeholder="5.99"
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Default Quantity <span className="text-red-500">*</span>
 </label>
 <input 
 type="number"
 value={editForm.quantity}
 onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 placeholder="999"
 />
 </div>
 </div>

 {sheetType ==="physical"&& (
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Default Shipping Profile
 </label>
 <select
 value={editForm.shipping_profile ||""}
 onChange={e => setEditForm({ ...editForm, shipping_profile: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {shippingProfiles.map(prof => (
 <option key={prof} value={prof}>
 {prof ||"None"}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Default Processing Profile
 </label>
 <select
 value={editForm.readiness_state_id ||""}
 onChange={e => setEditForm({ ...editForm, readiness_state_id: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {processingProfiles.map(prof => (
 <option key={prof} value={prof}>
 {prof ||"None"}
 </option>
 ))}
 </select>
 </div>
 </div>
 )}
 </div>
 )}

 {activeTab ==='options'&& (
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Who made it? <span className="text-red-500">*</span>
 </label>
 <select
 value={editForm.who_made}
 onChange={e => setEditForm({ ...editForm, who_made: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="i_did">I did</option>
 <option value="someone_else">Someone else</option>
 <option value="collective">A collective</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 When was it made? <span className="text-red-500">*</span>
 </label>
 <select
 value={editForm.when_made}
 onChange={e => setEditForm({ ...editForm, when_made: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_WHEN_MADE.map(when => {
 let label = when;
 if (when ==="made_to_order") label ="Made to order";
 else if (when.startsWith("before_")) label ="Before"+ when.split("_")[1];
 else if (when.includes("_")) label = when.replace("_","-");
 
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
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 What is it? <span className="text-red-500">*</span>
 </label>
 <select
 value={editForm.is_supply}
 onChange={e => setEditForm({ ...editForm, is_supply: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="false">A finished product</option>
 <option value="true">A supply or tool to make things</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Renewal Options <span className="text-red-500">*</span>
 </label>
 <select
 value={editForm.renewal_options}
 onChange={e => setEditForm({ ...editForm, renewal_options: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="automatic">Automatic</option>
 <option value="manual">Manual</option>
 </select>
 </div>
 </div>
 </div>
 )}

 {activeTab ==='attributes'&& (
 <div className="space-y-4">
 {/* General Colors */}
 <div className="border border-zinc-200 p-3 bg-zinc-50 rounded-none space-y-3">
 <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">General Attributes</h4>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Primary Color</label>
 <select
 value={editForm.primary_color ||"Auto"}
 onChange={e => setEditForm({ ...editForm, primary_color: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_COLORS.map(c => (
 <option key={c} value={c} className={c ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{c}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Secondary Color</label>
 <select
 value={editForm.secondary_color ||"Auto"}
 onChange={e => setEditForm({ ...editForm, secondary_color: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_COLORS.map(c => (
 <option key={c} value={c} className={c ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{c}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Occasion & Celebration */}
 <div className="grid grid-cols-2 gap-4">
 {categorySupportsOccasion(editForm.category) && (
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Occasion</label>
 <select
 value={editForm.occasion}
 onChange={e => setEditForm({ ...editForm, occasion: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_OCCASIONS.filter(Boolean).map(occ => (
 <option key={occ} value={occ} className={occ ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{occ}</option>
 ))}
 </select>
 </div>
 )}
 
 {categorySupportsCelebration(editForm.category) && (
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Celebration / Holiday</label>
 <select
 value={editForm.celebration}
 onChange={e => setEditForm({ ...editForm, celebration: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_CELEBRATIONS.filter(Boolean).map(cel => (
 <option key={cel} value={cel} className={cel ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{cel}</option>
 ))}
 </select>
 </div>
 )}
 </div>

 {categorySupportsSubject(editForm.category) && (
 <div className="relative">
 <label className="block text-xs font-medium text-zinc-700 mb-1">Subject (Art Only - Max 3)</label>
 <div 
 onClick={() => setIsSubjectOpen(!isSubjectOpen)}
 className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex justify-between items-center cursor-pointer min-h-[38px] select-none"
 >
 <span className="truncate">
 {editForm.subject ||"Select subjects..."}
 </span>
 <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isSubjectOpen ?'rotate-180':''}`} />
 </div>
 
 {isSubjectOpen && (
 <>
 <div className="fixed inset-0 z-10"onClick={() => setIsSubjectOpen(false)} />
 <div className="absolute left-0 bottom-full mb-1 w-full bg-white border border-zinc-300 shadow-lg z-20 max-h-60 overflow-y-auto p-2 space-y-1">
 {ETSY_SUBJECTS.filter(Boolean).map(sub => {
 const selectedList = (editForm.subject ||"").split(",").map(s => s.trim()).filter(Boolean);
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
 setEditForm({ ...editForm, subject: newList.join(",") });
 };

 return (
 <label key={sub} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 cursor-pointer text-sm text-zinc-800 select-none">
 <input 
 type="checkbox"
 checked={isChecked}
 onChange={toggleSubject}
 className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
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
 <label className="block text-xs font-medium text-zinc-700 mb-1">Graphic</label>
 <select
 value={editForm.graphic ||""}
 onChange={e => setEditForm({ ...editForm, graphic: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_GRAPHICS.filter(Boolean).map(gr => (
 <option key={gr} value={gr} className={gr ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{gr}</option>
 ))}
 </select>
 </div>
 )}

 {sheetType ==="physical"&& (
 <div className="border border-zinc-200 p-3 bg-zinc-50 rounded-none space-y-4">
 <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Physical attributes</h4>
 
 {/* Materials */}
 <div className="relative">
 <label className="block text-xs font-medium text-zinc-700 mb-1">Materials</label>
 <div 
 onClick={() => setIsMaterialsOpen(!isMaterialsOpen)}
 className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex justify-between items-center cursor-pointer min-h-[38px] select-none"
 >
 <span className="truncate">
 {editForm.materials ||"Select materials..."}
 </span>
 <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isMaterialsOpen ?'rotate-180':''}`} />
 </div>
 
 {isMaterialsOpen && (
 <>
 <div className="fixed inset-0 z-10"onClick={() => setIsMaterialsOpen(false)} />
 <div className="absolute left-0 bottom-full mb-1 w-full bg-white border border-zinc-300 shadow-lg z-20 max-h-60 overflow-y-auto p-2 space-y-1">
 {["Cotton","Polyester","Ceramic","Paper","Canvas","Wood","Metal","Glass","Enamel","Plastic","Vinyl","Leather"].map(mat => {
 const selectedList = (editForm.materials ||"").split(",").map(s => s.trim()).filter(Boolean);
 const isChecked = selectedList.includes(mat);
 
 const toggleMaterial = () => {
 let newList = [...selectedList];
 if (isChecked) {
 newList = newList.filter(m => m !== mat);
 } else {
 newList.push(mat);
 }
 setEditForm({ ...editForm, materials: newList.join(",") });
 };

 return (
 <label key={mat} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 cursor-pointer text-sm text-zinc-800 select-none">
 <input 
 type="checkbox"
 checked={isChecked}
 onChange={toggleMaterial}
 className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
 />
 {mat}
 </label>
 );
 })}
 
 <div className="border-t border-zinc-200 mt-2 pt-2">
 <label className="block text-[10px] font-bold uppercase text-zinc-405 mb-1 px-2">Custom Material</label>
 <input
 type="text"
 placeholder="Add custom, comma-separated..."
 value={editForm.materials ||""}
 onChange={e => setEditForm({ ...editForm, materials: e.target.value })}
 className="w-full px-2 py-1 text-xs border border-zinc-300 bg-white text-zinc-900 focus:outline-none"
 />
 </div>
 </div>
 </>
 )}
 </div>

 {/* Category-specific fields */}
 {(editForm.category ==="T-Shirts"|| editForm.category ==="Sweatshirts & Hoodies") && (
 <div className="grid grid-cols-2 gap-3 pt-2">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Sleeve Length</label>
 <select
 value={editForm.sleeve_length ||""}
 onChange={e => setEditForm({ ...editForm, sleeve_length: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_SLEEVE_LENGTH.map(sl => (
 <option key={sl} value={sl} className={sl ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{sl}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Neckline</label>
 <select
 value={editForm.neckline ||""}
 onChange={e => setEditForm({ ...editForm, neckline: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_NECKLINE.map(nl => (
 <option key={nl} value={nl} className={nl ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{nl}</option>
 ))}
 </select>
 </div>
 <div className="col-span-2">
 <label className="block text-xs font-medium text-zinc-700 mb-1">Clothing Style</label>
 <select
 value={editForm.clothing_style ||""}
 onChange={e => setEditForm({ ...editForm, clothing_style: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_CLOTHING_STYLE.map(st => (
 <option key={st} value={st} className={st ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{st}</option>
 ))}
 </select>
 </div>
 </div>
 )}

 {editForm.category ==="Mugs & Drinkware"&& (
 <div className="grid grid-cols-3 gap-3 pt-2">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Capacity</label>
 <select
 value={editForm.capacity ||""}
 onChange={e => setEditForm({ ...editForm, capacity: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_MUG_CAPACITY.map(cap => (
 <option key={cap} value={cap} className={cap ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{cap}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Dishwasher Safe</label>
 <select
 value={editForm.dishwasher_safe ||""}
 onChange={e => setEditForm({ ...editForm, dishwasher_safe: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="">Select...</option>
 <option value="Yes">Yes</option>
 <option value="No">No</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Microwave Safe</label>
 <select
 value={editForm.microwave_safe ||""}
 onChange={e => setEditForm({ ...editForm, microwave_safe: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="">Select...</option>
 <option value="Yes">Yes</option>
 <option value="No">No</option>
 </select>
 </div>
 </div>
 )}

 {editForm.category ==="Posters & Prints"&& (
 <div className="grid grid-cols-3 gap-3 pt-2">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Orientation</label>
 <select
 value={editForm.orientation ||""}
 onChange={e => setEditForm({ ...editForm, orientation: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_ORIENTATION.map(or => (
 <option key={or} value={or} className={or ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{or}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Framing</label>
 <select
 value={editForm.framing ||""}
 onChange={e => setEditForm({ ...editForm, framing: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_FRAMING.map(fr => (
 <option key={fr} value={fr} className={fr ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{fr}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Aspect Ratio</label>
 <select
 value={editForm.aspect_ratio ||""}
 onChange={e => setEditForm({ ...editForm, aspect_ratio: e.target.value })}
 className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 {ETSY_ASPECT_RATIO.map(ar => (
 <option key={ar} value={ar} className={ar ==="Auto"?"bg-blue-100 text-blue-800 font-medium":""}>{ar}</option>
 ))}
 </select>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {activeTab ==='variations'&& sheetType ==='physical'&& (
 <div className="space-y-4">
 {/* Variations Properties Addition and Config */}
 <div className="border border-zinc-200 p-3 bg-zinc-50 rounded-none space-y-4">
 <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
 <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Variation Properties</h4>
 {(!editForm.variations?.properties || editForm.variations.properties.length < 2) && (
 <select
 className="text-xs px-2 py-1 border border-zinc-300 bg-white text-zinc-800 focus:outline-none"
 onChange={(e) => {
 if (e.target.value ==="custom") {
 const name = prompt("Enter custom variation property name (e.g. Size, Color, Capacity, Style, Material, Paper):");
 if (name) {
 addVariationProperty(name, 0);
 }
 } else if (e.target.value) {
 const parts = e.target.value.split(":");
 addVariationProperty(parts[0], parseInt(parts[1]));
 }
 e.target.value ="";
 }}
 >
 <option value="">+ Add Variation Property...</option>
 {(() => {
 const standardDefs = ETSY_VARIATION_PROPERTY_DEFS[editForm.category] || [];
 const currentNames = (editForm.variations?.properties || []).map(p => p.name.toLowerCase());
 return standardDefs
 .filter(def => !currentNames.includes(def.name.toLowerCase()))
 .map(def => (
 <option key={def.name} value={def.name +":"+ def.propertyId}>
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
 <div key={prop.name} className="p-3 bg-white border border-zinc-200 space-y-2 relative">
 <button
 type="button"
 onClick={() => removeVariationProperty(propIdx)}
 className="absolute top-2.5 right-2.5 text-[11px] text-red-500 hover:text-red-755 font-semibold"
 title="Remove property"
 >
 Remove
 </button>
 
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-zinc-700">{prop.name}</span>
 <span className="text-[10px] text-zinc-400">ID: {prop.propertyId ||"Custom"}</span>
 </div>

 {/* Standard Suggestions Checkboxes */}
 {allowedSuggestions.length > 0 && (
 <div className="space-y-1">
 <span className="block text-[10px] font-bold uppercase text-zinc-400">Standard Options:</span>
 <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto border border-zinc-100 p-1.5 bg-zinc-50">
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
 <label key={opt} className="flex items-center gap-1 text-[11px] bg-white border border-zinc-200 px-1.5 py-0.5 rounded cursor-pointer select-none">
 <input 
 type="checkbox"
 checked={isChecked}
 onChange={toggleOpt}
 className="w-3.5 h-3.5 rounded text-blue-600 border-zinc-300 focus:ring-blue-500"
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
 className="w-full px-2 py-1 text-xs border border-zinc-300 bg-white focus:outline-none"
 onKeyDown={(e) => {
 if (e.key ==="Enter") {
 e.preventDefault();
 const val = e.currentTarget.value.trim();
 if (val && !prop.options.includes(val)) {
 updatePropertyOptions(propIdx, [...prop.options, val]);
 e.currentTarget.value ="";
 }
 }
 }}
 />
 <div className="flex flex-wrap gap-1 mt-1.5">
 {prop.options.map(opt => (
 <span key={opt} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-[11px]">
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
 <label className="block text-xs font-semibold text-zinc-700">
 Variation Matrix Combinations ({editForm.variations.combinations.filter(c => c.isEnabled).length} active)
 </label>
 <div className="max-h-80 overflow-y-auto border border-zinc-200">
 <table className="w-full text-left text-xs border-collapse bg-white">
 <thead>
 <tr className="bg-zinc-100 text-zinc-700 border-b border-zinc-200">
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
 const name = Object.keys(comb.values).map(k => comb.values[k]).join("/");
 return (
 <tr key={comb.id} className={"border-b border-zinc-100 hover:bg-zinc-50/50"+ (!comb.isEnabled ?"opacity-50 bg-zinc-50/20":"")}>
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
 className="w-3.5 h-3.5 text-blue-600 border-zinc-300"
 />
 </td>
 <td className="p-2 font-medium">{name}</td>
 <td className="p-2">
 <input
 type="text"
 placeholder={editForm.price ||"19.99"}
 value={comb.price ||""}
 disabled={!comb.isEnabled}
 onChange={(e) => {
 if (!editForm || !editForm.variations) return;
 const val = e.target.value.replace(/[^0-9.]/g,'');
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
 className="w-full px-1.5 py-0.5 border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none"
 />
 </td>
 <td className="p-2">
 <input
 type="text"
 placeholder={editForm.quantity ||"100"}
 value={comb.quantity ||""}
 disabled={!comb.isEnabled}
 onChange={(e) => {
 if (!editForm || !editForm.variations) return;
 const val = e.target.value.replace(/[^0-9]/g,'');
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
 className="w-full px-1.5 py-0.5 border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none"
 />
 </td>
 <td className="p-2">
 <input
 type="text"
 placeholder="{folder}-variant"
 value={comb.skuTemplate ||""}
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
 className="w-full px-1.5 py-0.5 border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none"
 />
 </td>
 <td className="p-2">
 <select
 value={comb.imageSlot ||""}
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
 className="w-full px-1.5 py-0.5 border border-zinc-300 bg-white text-xs text-zinc-800 focus:outline-none"
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

 {activeTab ==='ai'&& (
 <div className="space-y-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">AI Prompt Context (Rules)</label>
 <textarea 
 value={editForm.context}
 onChange={e => setEditForm({ ...editForm, context: e.target.value })}
 className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[120px] resize-y"
 placeholder="Enter any default AI instructions, SEO rules, or material descriptions for this preset..."
 />
 <p className="text-[11px] text-zinc-500 mt-1.5">
 This text is injected into the Context column for any listing using this preset.
 </p>
 </div>

 <details className="group border border-zinc-300 bg-white"open>
 <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 select-none hover:bg-zinc-50 list-none flex justify-between items-center">
 Advanced AI Rules
 <span className="text-zinc-400 group-open:rotate-180 transition-transform">▼</span>
 </summary>
 <div className="p-4 border-t border-zinc-200 space-y-4 bg-zinc-50">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Title Rule</label>
 <textarea 
 value={editForm.ai_title_rules || DEFAULT_PRESET.ai_title_rules}
 onChange={e => setEditForm({ ...editForm, ai_title_rules: e.target.value })}
 className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] resize-y"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Description Rule</label>
 <textarea 
 value={editForm.ai_desc_rules || DEFAULT_PRESET.ai_desc_rules}
 onChange={e => setEditForm({ ...editForm, ai_desc_rules: e.target.value })}
 className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px] resize-y"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">Tag Rule</label>
 <textarea 
 value={editForm.ai_tag_rules || DEFAULT_PRESET.ai_tag_rules}
 onChange={e => setEditForm({ ...editForm, ai_tag_rules: e.target.value })}
 className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] resize-y"
 />
 </div>
 </div>
 </details>
 </div>
 )}
 {activeTab ==='pod'&& sheetType ==="physical"&& (
 <div className="p-6 space-y-6">
 <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-sm">
 <label className="flex items-start gap-3 cursor-pointer">
 <div className="flex items-center h-5 mt-0.5">
 <input
 type="checkbox"
 checked={editForm.enable_pod || false}
 onChange={(e) => setEditForm({ ...editForm, enable_pod: e.target.checked })}
 className="w-4 h-4 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500"
 />
 </div>
 <div>
 <div className="text-sm font-medium text-zinc-900">
 Enable Printify Automation
 </div>
 <p className="text-xs text-zinc-500 mt-0.5">
 When enabled, listings pushed with this preset will automatically upload their design to Printify, create a draft product, and map the SKUs back to Etsy variations.
 </p>
 </div>
 </label>
 </div>

 {editForm.enable_pod && (
 <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Printify Blueprint
 </label>
 <div className="relative">
 <select
 value={editForm.pod_blueprint_id || 12}
 onChange={(e) => setEditForm({ ...editForm, pod_blueprint_id: Number(e.target.value) })}
 className="w-full appearance-none px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm"
 >
 {PREDEFINED_BLUEPRINTS.map(b => (
 <option key={b.id} value={b.id}>{b.name}</option>
 ))}
 </select>
 <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"/>
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Print Provider
 </label>
 <div className="relative">
 <select
 value={editForm.pod_print_provider_id || 99}
 onChange={(e) => setEditForm({ ...editForm, pod_print_provider_id: Number(e.target.value) })}
 className="w-full appearance-none px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm"
 >
 {PRINT_PROVIDERS.map(p => (
 <option key={p.id} value={p.id}>{p.name}</option>
 ))}
 </select>
 <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"/>
 </div>
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Print Position
 </label>
 <div className="flex bg-zinc-100 p-1 rounded-sm border border-zinc-200">
 {['top','center','bottom'].map((pos) => (
 <button
 key={pos}
 type="button"
 onClick={() => setEditForm({ ...editForm, pod_position: pos })}
 className={`flex-1 py-1.5 text-xs font-medium capitalize rounded-sm transition-colors ${
 (editForm.pod_position ||'top') === pos
 ?'bg-white shadow-sm text-blue-600'
 :'text-zinc-500 hover:text-zinc-700'
 }`}
 >
 {pos}
 </button>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 {/* Sticky Footer */}
 <div className="shrink-0 p-4 px-6 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center">
 <div>
 <span className="text-xs text-zinc-500 font-semibold select-none">Select rows in the grid to apply this preset</span>
 </div>
 <div className="flex gap-2">
 <button 
 onClick={handleSaveEdit}
 className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold border border-blue-700 transition-colors shadow-sm rounded-none uppercase tracking-wider"
 >
 <Save size={13} /> {isCreatingNew ?'Create Preset':'Save Preset'}
 </button>
 </div>
 </div>
 </div>
 ) : (



 <div className="flex-grow flex items-center justify-center text-zinc-400 p-8 text-xs font-bold uppercase tracking-wider select-none">
 No Preset Selected. Create or select a preset to edit.
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
