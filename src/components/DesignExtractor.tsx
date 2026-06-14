"use client";

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, ImageIcon, RefreshCw, Settings2, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ImagePresetManagerModal, { ImagePreset, DEFAULT_IMAGE_PRESET } from './ImagePresetManagerModal';

export default function DesignExtractor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [extractedImageUrl, setExtractedImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showPresets, setShowPresets] = useState(false);
  const [defaultPreset, setDefaultPreset] = useState<ImagePreset>(DEFAULT_IMAGE_PRESET);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedPresetsStr = localStorage.getItem("workstation_image_presets");
    const defaultId = localStorage.getItem("workstation_default_image_preset") || "default-graphic-extractor";
    if (savedPresetsStr) {
      try {
        const parsed = JSON.parse(savedPresetsStr);
        const active = parsed.find((p: any) => p.id === defaultId);
        if (active) setDefaultPreset(active);
      } catch {}
    }
  }, []);

  const processImage = async (file: File, url: string, activePreset: ImagePreset) => {
    setIsProcessing(true);
    setExtractedImageUrl(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('resolution', activePreset.resolution);
      formData.append('prompt', activePreset.prompt);
      
      let finalAspectRatio = activePreset.aspectRatio;
      if (finalAspectRatio === "Auto") {
        const img = new window.Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        const ratio = img.width / img.height;
        if (ratio > 1.5) finalAspectRatio = "16:9";
        else if (ratio > 1.1) finalAspectRatio = "4:3";
        else if (ratio < 0.6) finalAspectRatio = "9:16";
        else if (ratio < 0.9) finalAspectRatio = "3:4";
        else finalAspectRatio = "1:1";
      }
      formData.append('aspectRatio', finalAspectRatio);

      const response = await fetch('/api/image/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract graphic');
      }

      const data = await response.json();
      if (!data.image) throw new Error('No image returned');
      
      setExtractedImageUrl(data.image);
      toast.success('Graphic extracted successfully!');

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setOriginalImageUrl(url);
      
      processImage(file, url, defaultPreset);
    }
  };

  const handleDownload = () => {
    if (!extractedImageUrl) return;
    const a = document.createElement('a');
    a.href = extractedImageUrl;
    a.download = `extracted-graphic-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setSelectedFile(null);
    setOriginalImageUrl(null);
    setExtractedImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-white dark:bg-zinc-950">
      <div className="shrink-0 p-4 lg:px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            Nano Banana 2
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">PRO</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">AI-powered graphic extraction</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPresets(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Settings2 size={14} className="text-zinc-400" /> Presets
          </button>

          {originalImageUrl && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors shadow-sm"
            >
              <RefreshCw size={12} /> Start Over
            </button>
          )}
        </div>
      </div>

      {!originalImageUrl ? (
        <div className="flex-1 p-6 flex flex-col">
          <div 
            className="flex-1 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded flex flex-col items-center justify-center bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer min-h-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mb-3">
              <UploadCloud size={24} />
            </div>
            <h3 className="text-base font-medium text-zinc-800 dark:text-zinc-200 mb-1">Click to upload image</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">PNG, JPG, or WEBP</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1.5 rounded-full">
               Using preset: <span className="text-zinc-800 dark:text-zinc-200">{defaultPreset.name}</span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              style={{ display: "none" }}
              accept="image/*" 
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-2 bg-zinc-100/50 dark:bg-zinc-950/30">
          
          {/* Left Column */}
          <div className="min-w-0 min-h-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-medium text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-2 shrink-0">
              <ImageIcon size={12} /> Original Photo
            </div>
            <div className="flex-1 min-h-0 p-6 lg:p-12 relative overflow-hidden flex items-center justify-center">
              <img src={originalImageUrl} alt="Original" className="max-w-full max-h-full object-contain bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg p-2" />
            </div>
          </div>

          {/* Right Column */}
          <div className="min-w-0 min-h-0 flex flex-col">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-medium text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon size={12} /> Extracted Graphic
              </div>
              {extractedImageUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <Download size={12} /> Download
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 p-6 lg:p-12 relative overflow-hidden flex items-center justify-center">
                {extractedImageUrl ? (
                  <img src={extractedImageUrl} alt="Extracted" className="max-w-full max-h-full object-contain bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg p-2 animate-in zoom-in duration-300" />
                ) : (
                  <div className="w-full h-full max-w-sm max-h-sm mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 gap-3 p-6">
                    {isProcessing ? (
                      <>
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                        <p className="text-xs animate-pulse text-center">Rendering with {defaultPreset.name}...</p>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={32} className="opacity-20" />
                        <p className="text-xs text-center">Extraction failed or was cancelled.</p>
                        <button onClick={() => processImage(selectedFile!, originalImageUrl!, defaultPreset)} className="text-xs text-blue-500 hover:underline mt-2">Try Again</button>
                      </>
                    )}
                  </div>
                )}
            </div>
          </div>

        </div>
      )}

      {showPresets && (
         <ImagePresetManagerModal 
            onClose={() => setShowPresets(false)} 
            onSelectDefault={(preset) => setDefaultPreset(preset)}
         />
      )}
    </div>
  );
}



