"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, Loader2, Download, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export default function DesignExtractor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [extractedImageUrl, setExtractedImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File, url: string) => {
    setIsProcessing(true);
    setExtractedImageUrl(null);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/image/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process image");
      }

      const data = await response.json();
      if (!data.image) throw new Error("No image returned from AI");

      setExtractedImageUrl(data.image);
      toast.success("Design extracted successfully!");

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setOriginalImageUrl(url);
      
      await processImage(file, url);
    }
  };

  const handleDownload = () => {
    if (!extractedImageUrl) return;
    const a = document.createElement("a");
    a.href = extractedImageUrl;
    a.download = `extracted_design_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setSelectedFile(null);
    setOriginalImageUrl(null);
    setExtractedImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-6 bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">Design Extractor</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Upload a t-shirt photo to extract the graphic.</p>
        </div>
        {originalImageUrl && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw size={14} /> Start Over
          </button>
        )}
      </div>

      {!originalImageUrl ? (
        <div 
          className="flex-1 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer min-h-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <UploadCloud size={32} />
          </div>
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-1">Click to upload image</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">PNG, JPG, or WEBP</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*" 
          />
        </div>
      ) : (
        <div className="flex flex-row gap-6 flex-1 min-h-0">
          
          <div className="flex-1 min-w-0 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-medium text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2 shrink-0">
              <ImageIcon size={14} /> Original Photo
            </div>
            <div className="flex-1 p-4 flex items-center justify-center bg-zinc-100 dark:bg-zinc-950/50 overflow-hidden aspect-square">
              <img src={originalImageUrl} alt="Original" className="max-w-full max-h-full object-contain rounded drop-shadow-sm" />
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-medium text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2 shrink-0">
              <ImageIcon size={14} /> Extracted Graphic
            </div>
            <div className="flex-1 p-4 flex items-center justify-center bg-zinc-100 dark:bg-zinc-950/50 relative overflow-hidden aspect-square">
              {extractedImageUrl ? (
                <img src={extractedImageUrl} alt="Extracted" className="max-w-full max-h-full object-contain drop-shadow-md border border-zinc-200 dark:border-zinc-700 bg-white" />
              ) : (
                <div className="text-zinc-400 dark:text-zinc-600 flex flex-col items-center gap-3">
                  {isProcessing && (
                    <>
                      <Loader2 size={32} className="animate-spin text-blue-500" />
                      <p className="text-sm animate-pulse">Nano Banana 2 is rendering...</p>
                    </>
                  )}
                </div>
              )}
            </div>
            {extractedImageUrl && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                >
                  <Download size={18} /> Download PNG
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}


