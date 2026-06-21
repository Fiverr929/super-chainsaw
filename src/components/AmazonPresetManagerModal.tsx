'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Save, Layers, Copy } from 'lucide-react';

export type AmazonPreset = {
  id: string;
  name: string;
  col_1: string;
  col_2: string;
  col_3: string;
  col_4: string;
  col_5: string;
  col_6: string;
  col_7: string;
  col_8: string;
  col_9: string;
  col_10: string;
  [key: string]: string;
};

export const DEFAULT_AMAZON_PRESET: AmazonPreset = {
  id: "default-amazon",
  name: "Default Amazon Preset",
  col_1: "",
  col_2: "",
  col_3: "",
  col_4: "",
  col_5: "",
  col_6: "",
  col_7: "",
  col_8: "",
  col_9: "",
  col_10: ""
};

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
      setEditForm({ ...chosen });
      setIsCreatingNew(false);
    }
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    const newPreset: AmazonPreset = {
      id: "preset-amazon-" + Date.now(),
      name: "New Amazon Preset",
      col_1: "",
      col_2: "",
      col_3: "",
      col_4: "",
      col_5: "",
      col_6: "",
      col_7: "",
      col_8: "",
      col_9: "",
      col_10: ""
    };
    setEditForm(newPreset);
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
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (presets.length <= 1) {
      alert("You must keep at least one preset.");
      return;
    }

    const newPresets = presets.filter(p => p.id !== id);
    setPresets(newPresets);
    localStorage.setItem('workstation_v2_presets_amazon', JSON.stringify(newPresets));

    if (activePresetId === id) {
      const fallback = newPresets[0];
      setActivePresetId(fallback.id);
      setEditForm({ ...fallback });
    }
  };

  const handleDuplicate = (preset: AmazonPreset) => {
    const duplicated: AmazonPreset = {
      ...preset,
      id: "preset-amazon-" + Date.now(),
      name: `${preset.name} (Copy)`
    };
    const newPresets = [...presets, duplicated];
    setPresets(newPresets);
    localStorage.setItem('workstation_v2_presets_amazon', JSON.stringify(newPresets));
    setActivePresetId(duplicated.id);
    setEditForm({ ...duplicated });
  };

  const handleApply = () => {
    if (!editForm) return;
    onApplyPreset(editForm);
    onClose();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/50 p-4" onClick={handleClose}>
      <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl" style={{ height: "80vh", minHeight: "600px", maxHeight: "850px" }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 shrink-0">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Amazon Listing Presets</h2>
          <button onClick={handleClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 rounded-none">
            <X size={18} />
          </button>
        </div>

        {/* Content Area - Split View */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          
          {/* Left Side: Preset List */}
          <div className="w-1/3 border-r border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-300 dark:border-zinc-700 shrink-0">
              <button 
                onClick={handleCreateNew}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-none shadow-sm"
              >
                <Plus size={16} /> Create New Preset
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {presets.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className={`group flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer ${
                    activePresetId === p.id && !isCreatingNew
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="overflow-hidden">
                    <h4 className={`text-sm font-medium truncate ${activePresetId === p.id ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      {p.name}
                    </h4>
                    <p className="text-xs text-zinc-500 truncate">
                      Amazon Preset
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 pl-2 ${activePresetId === p.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(p); }}
                      className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-none"
                      title="Duplicate Preset"
                    >
                      <Copy size={14} />
                    </button>
                    <button 
                      onClick={(e) => handleDeletePreset(p.id, e)}
                      className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-none"
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
          <div className="w-2/3 bg-white dark:bg-zinc-950 flex flex-col h-full relative min-h-0">
            {editForm ? (
              <div className="flex flex-col h-full min-h-0">
                {/* Header/Tabs */}
                <div className="p-6 pb-0 shrink-0">
                  <div className="flex items-end justify-between border-b border-zinc-200 dark:border-zinc-800 pb-0">
                    <div className="flex flex-1 min-w-0 text-xs font-semibold uppercase tracking-wider text-zinc-500 overflow-x-auto select-none gap-2 pr-4 custom-scrollbar -mb-px">
                      <button
                        type="button"
                        className="whitespace-nowrap shrink-0 pb-2 px-3 border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                      >
                        Core Columns (Col 1-10)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Preset Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="e.g. Amazon T-Shirt Default"
                    />
                  </div>

                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                    <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Columns Values</span>
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const colKey = `col_${idx + 1}` as keyof AmazonPreset;
                        return (
                          <div key={colKey}>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Col {idx + 1}
                            </label>
                            <input 
                              type="text"
                              value={editForm[colKey] as string}
                              onChange={e => setEditForm({ ...editForm, [colKey]: e.target.value })}
                              className="w-full px-3 py-2 text-sm rounded-none border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="shrink-0 p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                  <div>
                    {selectedRowsCount > 0 ? (
                      <button 
                        onClick={handleApply}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold border border-emerald-700 transition-colors shadow-sm rounded-none"
                      >
                        Apply to {selectedRowsCount} Selected Row(s)
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">Select rows in the grid to apply this preset</span>
                    )}
                  </div>
                  <button 
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium border border-blue-700 transition-colors shadow-sm rounded-none"
                  >
                    <Save size={14} /> {isCreatingNew ? 'Create Preset' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                <Layers size={36} className="mb-2 text-zinc-300 dark:text-zinc-800 animate-pulse" />
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">No Preset Selected</h3>
                <p className="text-xs text-center max-w-[250px]">Select a preset from the sidebar to edit, or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
