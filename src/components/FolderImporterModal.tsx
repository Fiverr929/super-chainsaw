'use client';

import React, { useState, useEffect, useCallback } from'react';
import { X, Folder, CheckSquare, Square, RefreshCw, Upload } from'lucide-react';
import { type Preset, DEFAULT_PRESET, DEFAULT_PHYSICAL_PRESET } from'./PresetManagerModal';
import { type AmazonPreset, DEFAULT_AMAZON_PRESET } from'./AmazonPresetManagerModal';

type ListingPreset = Preset | AmazonPreset;

interface FolderImporterModalProps {
 sheetType:'digital'|'physical'|'amazon';
 onClose: () => void;
 onImport: (selectedFolders: string[], preset: ListingPreset | null) => void;
}

export default function FolderImporterModal({ sheetType, onClose, onImport }: FolderImporterModalProps) {
 const [folders, setFolders] = useState<string[]>([]);
 const [selected, setSelected] = useState<Set<string>>(new Set());
 const [presets, setPresets] = useState<ListingPreset[]>([]);
 const [selectedPresetId, setSelectedPresetId] = useState<string>('');
 const [isLoading, setIsLoading] = useState(false);

 const scanFolders = useCallback(async () => {
 setIsLoading(true);
 try {
 const res = await fetch(`/api/local/scan?type=${sheetType}`);
 if (res.ok) {
 const data: { folders?: string[] } = await res.json();
 const scannedFolders = data.folders || [];
 setFolders(scannedFolders);
 setSelected(new Set(scannedFolders));
 }
 } catch (error) {
 console.error("Failed to scan folders:", error);
 } finally {
 setIsLoading(false);
 }
 }, [sheetType]);

 useEffect(() => {
 // Load presets based on sheet type
 let key ='';
 let defaultPreset: ListingPreset = DEFAULT_PRESET;
 if (sheetType ==='digital') {
 key ='workstation_v2_presets';
 defaultPreset = DEFAULT_PRESET;
 } else if (sheetType ==='physical') {
 key ='workstation_v2_presets_physical';
 defaultPreset = DEFAULT_PHYSICAL_PRESET;
 } else if (sheetType ==='amazon') {
 key ='workstation_v2_presets_amazon';
 defaultPreset = DEFAULT_AMAZON_PRESET;
 }

 const saved = localStorage.getItem(key);
 if (saved) {
 try {
 const parsed: unknown = JSON.parse(saved);
 if (!Array.isArray(parsed)) throw new Error("Invalid preset list");
 const parsedPresets = parsed as ListingPreset[];
 setPresets(parsedPresets);
 if (parsedPresets.length > 0) {
 setSelectedPresetId(parsedPresets[0].id);
 }
 } catch (e) {
 console.error("Failed to parse presets", e);
 setPresets([defaultPreset]);
 }
 } else {
 setPresets([defaultPreset]);
 }
 
 // Scan folders immediately on open
 scanFolders();
 }, [scanFolders, sheetType]);

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

 const getScanPath = () => {
 if (sheetType ==='digital') return'public/listings/';
 if (sheetType ==='physical') return'public/listings-physical/';
 return'public/listings-amazon/';
 };

 return (
 <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/50 p-4"onClick={onClose}>
 <div className="bg-white border border-zinc-300 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"onClick={e => e.stopPropagation()}>
 
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-zinc-300 bg-zinc-50">
 <div className="flex items-center gap-2">
 <h2 className="text-base font-semibold text-zinc-800">Import Local Folders</h2>
 </div>
 <button onClick={onClose} className="p-1 hover:bg-zinc-200 text-zinc-500">
 <X size={18} />
 </button>
 </div>

 <div className="p-6 flex-1 overflow-y-auto space-y-6">
 
 <div className="flex items-center justify-between">
 <p className="text-sm text-zinc-600">
 Scanning <code className="bg-zinc-100 px-1 py-0.5 border border-zinc-200">{getScanPath()}</code> for product folders.
 </p>
 <button 
 onClick={scanFolders}
 disabled={isLoading}
 className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
 >
 <RefreshCw size={14} className={isLoading ?"animate-spin":""} /> Rescan
 </button>
 </div>

 <div className="border border-zinc-300 bg-zinc-50">
 <div className="flex items-center justify-between p-3 border-b border-zinc-300 bg-white">
 <div 
 className="flex items-center gap-3 cursor-pointer text-sm font-medium text-zinc-800"
 onClick={toggleAll}
 >
 {selected.size === folders.length && folders.length > 0 ? (
 <CheckSquare size={16} className="text-blue-600"/>
 ) : (
 <Square size={16} className="text-zinc-400"/>
 )}
 Select All ({selected.size}/{folders.length})
 </div>
 </div>
 
 <div className="max-h-[300px] overflow-y-auto">
 {folders.length === 0 ? (
 <div className="p-8 text-center text-sm text-zinc-500">
 No subfolders found in <code>{getScanPath()}</code>.
 </div>
 ) : (
 folders.map(folder => (
 <div 
 key={folder}
 onClick={() => toggleFolder(folder)}
 className="flex items-center gap-3 p-3 border-b border-zinc-200 last:border-0 hover:bg-zinc-100 cursor-pointer transition-colors"
 >
 {selected.has(folder) ? (
 <CheckSquare size={16} className="text-blue-600 shrink-0"/>
 ) : (
 <Square size={16} className="text-zinc-400 shrink-0"/>
 )}
 <Folder size={16} className="text-blue-500 shrink-0"/>
 <span className="text-sm text-zinc-700 truncate">{folder}</span>
 </div>
 ))
 )}
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-zinc-700 mb-1">
 Apply Preset to Imported Folders (Optional)
 </label>
 <select 
 value={selectedPresetId}
 onChange={e => setSelectedPresetId(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
 >
 <option value="">None (Empty Rows)</option>
 {presets.map(p => (
 <option key={p.id} value={p.id}>{p.name}</option>
 ))}
 </select>
 </div>

 </div>

 {/* Footer */}
 <div className="p-4 border-t border-zinc-300 bg-zinc-50 flex justify-end gap-3">
 <button 
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 bg-white hover:bg-zinc-100"
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
