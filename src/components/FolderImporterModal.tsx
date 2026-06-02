'use client';

import React, { useState, useEffect } from 'react';
import { X, Folder, CheckSquare, Square, RefreshCw, Upload } from 'lucide-react';
import { Preset } from './PresetManagerModal';

interface FolderImporterModalProps {
  onClose: () => void;
  onImport: (selectedFolders: string[], preset: Preset | null) => void;
}

export default function FolderImporterModal({ onClose, onImport }: FolderImporterModalProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const scanFolders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/local/scan');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        // Automatically select all by default
        setSelected(new Set(data.folders || []));
      }
    } catch (error) {
      console.error("Failed to scan folders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load presets
    const saved = localStorage.getItem("workstation_v2_presets");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPresets(parsed);
        if (parsed.length > 0) {
          setSelectedPresetId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse presets", e);
      }
    }
    
    // Scan folders immediately on open
    scanFolders();
  }, []);

  const toggleFolder = (folder: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(folder)) {
      newSelected.delete(folder);
    } else {
      newSelected.add(folder);
    }
    setSelected(newSelected);
  };

  const toggleAll = () => {
    if (selected.size === folders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(folders));
    }
  };

  const handleImport = () => {
    if (selected.size === 0) return;
    const chosenPreset = presets.find(p => p.id === selectedPresetId) || null;
    onImport(Array.from(selected), chosenPreset);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Import Local Folders</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Scanning <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 border border-zinc-200 dark:border-zinc-700">public/listings/</code> for product folders.
            </p>
            <button 
              onClick={scanFolders}
              disabled={isLoading}
              className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Rescan
            </button>
          </div>

          <div className="border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between p-3 border-b border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              <div 
                className="flex items-center gap-3 cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200"
                onClick={toggleAll}
              >
                {selected.size === folders.length && folders.length > 0 ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : (
                  <Square size={16} className="text-zinc-400" />
                )}
                Select All ({selected.size}/{folders.length})
              </div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto">
              {folders.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  No subfolders found in <code>public/listings/</code>.
                </div>
              ) : (
                folders.map(folder => (
                  <div 
                    key={folder}
                    onClick={() => toggleFolder(folder)}
                    className="flex items-center gap-3 p-3 border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  >
                    {selected.has(folder) ? (
                      <CheckSquare size={16} className="text-blue-600 shrink-0" />
                    ) : (
                      <Square size={16} className="text-zinc-400 shrink-0" />
                    )}
                    <Folder size={16} className="text-blue-500 shrink-0" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{folder}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Apply Preset to Imported Folders (Optional)
            </label>
            <select 
              value={selectedPresetId}
              onChange={e => setSelectedPresetId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">None (Empty Rows)</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button 
            onClick={handleImport}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium border border-blue-700 disabled:opacity-50"
          >
            <Upload size={16} /> Import {selected.size} Folders
          </button>
        </div>
      </div>
    </div>
  );
}
