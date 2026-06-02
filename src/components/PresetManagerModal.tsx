"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { ETSY_CATEGORIES, ETSY_SECTIONS, ETSY_WHEN_MADE, ETSY_TAXONOMY_MAP } from "@/lib/etsyConstants";
import { useEtsyTaxonomy, EtsyProperty } from "@/hooks/useEtsyTaxonomy";

export type Preset = {
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
  ai_title_rules: string;
  ai_desc_rules: string;
  ai_tag_rules: string;
  [key: string]: any;
};

const DEFAULT_PRESET: Preset = {
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
  ai_title_rules: "MUST be exactly 140 characters or less including spaces",
  ai_desc_rules: "Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
  ai_tag_rules: "EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
};

interface PresetManagerModalProps {
  onClose: () => void;
}

export default function PresetManagerModal({ onClose }: PresetManagerModalProps) {
  const [presets, setPresets] = useState<Preset[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workstation_v2_presets");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [DEFAULT_PRESET];
        }
      }
    }
    return [DEFAULT_PRESET];
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Preset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { fetchPropertiesForTaxonomy } = useEtsyTaxonomy();
  const [dynamicProps, setDynamicProps] = useState<EtsyProperty[]>([]);

  React.useEffect(() => {
    if (!editForm?.category) {
      setDynamicProps([]);
      return;
    }
    const taxId = ETSY_TAXONOMY_MAP[editForm.category];
    if (taxId) {
      fetchPropertiesForTaxonomy(taxId).then(setDynamicProps);
    } else {
      setDynamicProps([]);
    }
  }, [editForm?.category, fetchPropertiesForTaxonomy]);

  const savePresets = (newPresets: Preset[]) => {
    setPresets(newPresets);
    localStorage.setItem("workstation_v2_presets", JSON.stringify(newPresets));
  };

  const handleAddNew = () => {
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: "New Preset",
      category: "",
      section: "",
      price: "0.00",
      quantity: "999",
      context: "",
      who_made: "i_did",
      when_made: "2020_2026",
      is_supply: "false",
      renewal_options: "manual",
      ai_title_rules: "MUST be exactly 140 characters or less including spaces",
      ai_desc_rules: "Under 100 words total. One short punchy intro sentence, followed entirely by a scannable bullet-point list of the essential features/specs. NO FLUFF. No conclusion paragraphs.",
      ai_tag_rules: "EXACTLY 13 Etsy Tags as a comma-separated string. Each individual tag MUST be 20 characters or less.",
    };
    
    // Immediately add the pill to the sidebar (top of the list)
    const newPresetsList = [newPreset, ...presets];
    setPresets(newPresetsList);
    
    setEditingId(newPreset.id);
    setEditForm(newPreset);
    setIsCreatingNew(true);
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
                      {ETSY_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
                      {ETSY_SECTIONS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
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


                <div className="grid grid-cols-2 gap-4">
                  {dynamicProps.map(prop => (
                    <div key={prop.property_id}>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">{prop.display_name}</label>
                      <select
                        value={editForm[`prop_${prop.property_id}`] || ""}
                        onChange={e => setEditForm({ ...editForm, [`prop_${prop.property_id}`]: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="">None</option>
                        {prop.possible_values.map(v => (
                          <option key={v.name} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

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

                <details className="group border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
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


