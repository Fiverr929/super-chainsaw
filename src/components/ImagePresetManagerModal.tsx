"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Save, Star } from "lucide-react";
import toast from "react-hot-toast";

export type ImagePreset = {
  id: string;
  name: string;
  prompt: string;
  resolution: string;
  aspectRatio: string;
  thinkingLevel: string;
};

export const DEFAULT_IMAGE_PRESET: ImagePreset = {
  id: "default-graphic-extractor",
  name: "Graphic Extractor",
  prompt: "",
  resolution: "1K",
  aspectRatio: "Auto",
  thinkingLevel: "High"
};

interface ImagePresetManagerModalProps {
  onClose: () => void;
  onSelectDefault: (preset: ImagePreset) => void;
}

export default function ImagePresetManagerModal({ onClose, onSelectDefault }: ImagePresetManagerModalProps) {
  const [presets, setPresets] = useState<ImagePreset[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workstation_image_presets");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return [DEFAULT_IMAGE_PRESET];
  });

  const [defaultPresetId, setDefaultPresetId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("workstation_default_image_preset") || "default-graphic-extractor";
    }
    return "default-graphic-extractor";
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ImagePreset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const savePresets = (newPresets: ImagePreset[]) => {
    setPresets(newPresets);
    localStorage.setItem("workstation_image_presets", JSON.stringify(newPresets));
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setIsCreatingNew(true);
    setEditForm({
      id: "preset-" + Date.now(),
        name: "New Preset",
        prompt: "",
      resolution: "1K",
      aspectRatio: "Auto",
        thinkingLevel: "High"
      });
  };

  const handleEdit = (preset: ImagePreset) => {
    setEditingId(preset.id);
    setIsCreatingNew(false);
    setEditForm({ ...preset });
  };

  const handleDelete = (id: string) => {
    if (presets.length === 1) {
      toast.error("You must have at least one preset.");
      return;
    }
    const newPresets = presets.filter((p) => p.id !== id);
    savePresets(newPresets);
    if (editingId === id) {
      setEditingId(null);
      setEditForm(null);
    }
    if (defaultPresetId === id) {
      setDefaultPreset(newPresets[0].id);
    }
    toast.success("Preset deleted");
  };

  const handleSave = () => {
    if (!editForm) return;
    if (!editForm.name.trim()) {
      toast.error("Preset name is required");
      return;
    }

    const newPresets = [...presets];
    if (isCreatingNew) {
      newPresets.push(editForm);
    } else {
      const idx = newPresets.findIndex((p) => p.id === editForm.id);
      if (idx !== -1) {
        newPresets[idx] = editForm;
      }
    }

    savePresets(newPresets);
    setEditingId(null);
    setEditForm(null);
    setIsCreatingNew(false);
    
    if (editForm.id === defaultPresetId) {
       onSelectDefault(editForm);
    }
    
    toast.success("Preset saved");
  };

  const setDefaultPreset = (id: string) => {
    setDefaultPresetId(id);
    localStorage.setItem("workstation_default_image_preset", id);
    const preset = presets.find(p => p.id === id);
    if (preset) {
        onSelectDefault(preset);
        toast.success(`Set "${preset.name}" as default`);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl" style={{ height: "80vh", minHeight: "600px", maxHeight: "850px" }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Listing Presets</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Content Area - Split View */}
        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Left Side: Preset List */}
          <div className="w-1/3 border-r border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-300 dark:border-zinc-700">
              <button 
                onClick={handleCreateNew}
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
                    (editingId === preset.id && !isCreatingNew)
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' 
                      : 'bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                  onClick={() => handleEdit(preset)}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <h4 className={`text-sm font-medium truncate ${editingId === preset.id && !isCreatingNew ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {preset.name}
                    </h4>
                  </div>
                  <div className={`flex items-center gap-2 pl-2 ${(editingId === preset.id && !isCreatingNew) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setDefaultPreset(preset.id); }}
                        className="text-zinc-400 hover:text-blue-500"
                        title="Set as Default"
                     >
                        <Star size={14} className={defaultPresetId === preset.id ? "text-blue-500 fill-blue-500" : ""} />
                     </button>
                    {preset.id !== "default-graphic-extractor" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
                        className="text-zinc-400 hover:text-red-500"
                        title="Delete Preset"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Editor */}
          <div className="w-2/3 bg-white dark:bg-zinc-950 flex flex-col overflow-hidden">
            {editForm ? (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  
                  {/* Simulated Tab Header matched from Spreadsheet */}
                  <div className="flex items-end justify-between border-b border-zinc-200 dark:border-zinc-800 pb-0 mb-6">
                    <div className="flex flex-1 min-w-0 text-xs font-semibold uppercase tracking-wider text-zinc-500 overflow-x-auto select-none gap-2 pr-4 custom-scrollbar -mb-px">
                      <button className="whitespace-nowrap shrink-0 pb-2 px-3 border-b-2 transition-all duration-150 border-blue-600 text-blue-600 dark:text-blue-400 font-bold">
                        {isCreatingNew ? 'Create New Preset' : 'Edit Preset'}
                      </button>
                    </div>
                  </div>

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
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Resolution
                      </label>
                      <select 
                        value={editForm.resolution}
                        onChange={e => setEditForm({ ...editForm, resolution: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="512">512</option>
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Aspect Ratio
                      </label>
                      <select 
                        value={editForm.aspectRatio}
                        onChange={e => setEditForm({ ...editForm, aspectRatio: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="Auto">Auto (Detect from image)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="3:4">3:4 (Portrait)</option>
                        <option value="4:3">4:3 (Landscape)</option>
                        <option value="9:16">9:16 (Tall)</option>
                        <option value="16:9">16:9 (Wide)</option>
                      </select>
                    </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Thinking Level
                        </label>
                        <select 
                          value={editForm.thinkingLevel || 'High'}
                          onChange={e => setEditForm({ ...editForm, thinkingLevel: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="Minimal">Minimal</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      AI System Prompt
                    </label>
                    <textarea 
                      value={editForm.prompt}
                      onChange={e => setEditForm({ ...editForm, prompt: e.target.value })}
                      rows={8}
                      className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>
              
              {/* Sticky Footer */}
              <div className="shrink-0 p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium border border-blue-700 transition-colors shadow-sm rounded-sm"
                >
                  <Save size={14} /> {isCreatingNew ? 'Create Preset' : 'Save Changes'}
                </button>
              </div>
            </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-zinc-500 dark:text-zinc-400">
                <Star size={40} className="mb-3 text-zinc-300 dark:text-zinc-700" />
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


