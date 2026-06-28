"use client";

import React, { useState, useRef, useEffect } from'react';
import Image from'next/image';
import { UploadCloud, FileText, ImageIcon, RefreshCw, Settings2, Download, Loader2, Eraser } from'lucide-react';
import toast from'react-hot-toast';
import ImagePresetManagerModal, { ImagePreset, DEFAULT_IMAGE_PRESET } from'./ImagePresetManagerModal';

export default function DesignExtractor() {
 const [selectedFile, setSelectedFile] = useState<File | null>(null);
 const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
 const [extractedImageUrl, setExtractedImageUrl] = useState<string | null>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [isRemovingBg, setIsRemovingBg] = useState(false);
 
 const [showPresets, setShowPresets] = useState(false);
 
 const testFileInputRef = useRef<HTMLInputElement>(null);
 const handleTestFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 if (!file.type.startsWith('image/')) {
 toast.error('Please upload an image file');
 return;
 }
 const url = URL.createObjectURL(file);
 setExtractedImageUrl(url);
 // Clear the actual extracted image if any, so we strictly test the uploaded one
 // Note: we leave originalImageUrl alone so the left side doesn't break, 
 // or we could clear it if we want.
 }
 };
 const [defaultPreset, setDefaultPreset] = useState<ImagePreset>(DEFAULT_IMAGE_PRESET);
 
 const fileInputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 const savedPresetsStr = localStorage.getItem("workstation_image_presets");
 const defaultId = localStorage.getItem("workstation_default_image_preset") ||"default-graphic-extractor";
 if (savedPresetsStr) {
 try {
 const parsed: unknown = JSON.parse(savedPresetsStr);
 if (!Array.isArray(parsed)) return;
 const active = (parsed as ImagePreset[]).find(p => p.id === defaultId);
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
 if (finalAspectRatio ==="Auto") {
 const img = new window.Image();
 img.src = url;
 await new Promise((resolve) => {
 img.onload = resolve;
 });
 const ratio = img.width / img.height;
 if (ratio > 1.5) finalAspectRatio ="16:9";
 else if (ratio > 1.1) finalAspectRatio ="4:3";
 else if (ratio < 0.6) finalAspectRatio ="9:16";
 else if (ratio < 0.9) finalAspectRatio ="3:4";
 else finalAspectRatio ="1:1";
 }
 formData.append('aspectRatio', finalAspectRatio);
 formData.append('thinkingLevel', activePreset.thinkingLevel ||'Medium');

 const response = await fetch('/api/image/extract', {
 method:'POST',
 body: formData,
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error ||'Failed to extract graphic');
 }

 const data = await response.json();
 if (!data.image) throw new Error('No image returned');
 
 setExtractedImageUrl(data.image);
 toast.success('Graphic extracted successfully!');

 } catch (error: unknown) {
 console.error(error);
 toast.error(error instanceof Error ? error.message :'Failed to process image');
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

 
 
 
 const applyColorKey = () => {
 const toleranceLevel = 40;
 if (!extractedImageUrl) return;
 
 const img = new window.Image();
 img.onload = () => {
 const canvas = document.createElement('canvas');
 canvas.width = img.width;
 canvas.height = img.height;
 const ctx = canvas.getContext('2d', { willReadFrequently: true });
 if (!ctx) return;

 ctx.drawImage(img, 0, 0);
 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
 const data = imageData.data;

 // Sample top-left corner as the definitive background color
 // Averaging corners fails if the background is a gradient.
 const avgR = data[0];
 const avgG = data[1];
 const avgB = data[2];

 for (let i = 0; i < data.length; i += 4) {
 const r = data[i];
 const g = data[i+1];
 const b = data[i+2];

 const dist = Math.sqrt(
 Math.pow(r - avgR, 2) + 
 Math.pow(g - avgG, 2) + 
 Math.pow(b - avgB, 2)
 );

 if (dist <= toleranceLevel) {
 data[i+3] = 0; // Make transparent
 } else if (dist <= toleranceLevel * 1.5) {
 // Soft edge blending
 const alphaStr = (dist - toleranceLevel) / (toleranceLevel * 0.5);
 data[i+3] = Math.min(255, Math.floor(255 * alphaStr));
 }
 }

 ctx.putImageData(imageData, 0, 0);
 // Display directly in a secondary preview if we wanted, but we'll just overwrite
 const newUrl = canvas.toDataURL('image/png');
 setExtractedImageUrl(newUrl);
 setIsRemovingBg(false);
 };
 img.src = extractedImageUrl;
 };

 const handleRemoveBackground = () => {
 setIsRemovingBg(true);
 applyColorKey();
 };

 const handleDownload = () => {
 if (!extractedImageUrl) return;
 const a = document.createElement('a');
 a.href = extractedImageUrl;
 a.download =`extracted-graphic-${Date.now()}.png`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 };

 const reset = () => {
 setSelectedFile(null);
 setOriginalImageUrl(null);
 setExtractedImageUrl(null);
 if (fileInputRef.current) {
 fileInputRef.current.value ='';
 }
 };

 return (
 <div className="w-full h-full flex flex-col min-h-0 bg-white">
 <div className="shrink-0 p-4 lg:px-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
 <div>
 <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
 Nano Banana 2
 <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">PRO</span>
 </h2>
 <p className="text-xs text-zinc-500">AI-powered graphic extraction</p>
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={() => setShowPresets(true)}
 className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors shadow-sm"
 >
 <Settings2 size={14} className="text-zinc-400"/> Presets
 </button>

 <input 
 type="file"
 ref={testFileInputRef} 
 onChange={handleTestFileChange} 
 accept="image/*"
 className="hidden"
 />
 <button
 onClick={() => testFileInputRef.current?.click()}
 className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors shadow-sm"
 title="Upload a local image directly into the right-hand column to test the Background Removal algorithm without hitting the Gemini API."
 >
 <FileText size={14} className="text-emerald-500"/> Test Local Image
 </button>

 {originalImageUrl && (
 <button
 onClick={reset}
 className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors shadow-sm"
 >
 <RefreshCw size={12} /> Start Over
 </button>
 )}
 </div>
 </div>

 {!originalImageUrl ? (
 <div className="flex-1 p-6 flex flex-col">
 <div 
 className="flex-1 border-2 border-dashed border-zinc-300 rounded flex flex-col items-center justify-center bg-white hover:bg-zinc-50 transition-colors cursor-pointer min-h-0"
 onClick={() => fileInputRef.current?.click()}
 >
 <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3">
 <UploadCloud size={24} />
 </div>
 <h3 className="text-base font-medium text-zinc-800 mb-1">Click to upload image</h3>
 <p className="text-xs text-zinc-500">PNG, JPG, or WEBP</p>
 <div className="mt-4 flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-full">
 Using preset: <span className="text-zinc-800">{defaultPreset.name}</span>
 </div>
 <input 
 type="file"
 ref={fileInputRef} 
 onChange={handleFileChange} 
 className="hidden"
 style={{ display:"none"}}
 accept="image/*"
 />
 </div>
 </div>
 ) : (
 <div className="flex-1 min-h-0 grid grid-cols-2 bg-zinc-100/50">
 
 {/* Left Column */}
 <div className="min-w-0 min-h-0 flex flex-col border-r border-zinc-200">
 <div className="p-3 border-b border-zinc-200 bg-white font-medium text-xs text-zinc-700 flex items-center gap-2 shrink-0">
 <ImageIcon size={12} /> Original Photo
 </div>
 <div className="flex-1 min-h-0 p-6 lg:p-12 relative overflow-hidden">
 <div className="w-full h-full relative flex items-center justify-center">
 <Image src={originalImageUrl} alt="Original"fill unoptimized sizes="50vw"className="object-contain bg-white border border-zinc-200 shadow-sm rounded-lg p-2"/>
 </div>
 </div>
 </div>

 {/* Right Column */}
 <div className="min-w-0 min-h-0 flex flex-col">
 <div className="p-3 border-b border-zinc-200 bg-white font-medium text-xs text-zinc-700 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-2">
 <ImageIcon size={12} /> Extracted Graphic
 </div>
 {extractedImageUrl && (
 <div className="flex items-center gap-4">
 <button
 onClick={handleRemoveBackground}
 disabled={isRemovingBg}
 className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50"
 >
 {isRemovingBg ? <Loader2 size={12} className="animate-spin"/> : <Eraser size={12} />} 
 {isRemovingBg ?'Removing...':'Remove BG'}
 </button>
 <button
 onClick={handleDownload}
 className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
 >
 <Download size={12} /> Download
 </button>
 </div>
 )}
 </div>
 <div className="flex-1 min-h-0 p-6 lg:p-12 relative overflow-hidden">
 <div className="w-full h-full relative flex items-center justify-center">
 {extractedImageUrl ? (
 <Image src={extractedImageUrl} alt="Extracted"fill unoptimized sizes="50vw"className="object-contain bg-white border border-zinc-200 shadow-sm rounded-lg p-2 animate-in zoom-in duration-300"/>
 ) : (
 <div className="w-full max-w-sm aspect-square mx-auto bg-white border border-zinc-200 shadow-sm rounded-lg flex flex-col items-center justify-center text-zinc-400 gap-3 p-6 relative z-10">
 {isProcessing ? (
 <>
 <Loader2 size={24} className="animate-spin text-blue-500"/>
 <p className="text-xs animate-pulse text-center">Rendering with {defaultPreset.name}...</p>
 </>
 ) : (
 <>
 <ImageIcon size={32} className="opacity-20"/>
 <p className="text-xs text-center">Extraction failed or was cancelled.</p>
 <button onClick={() => processImage(selectedFile!, originalImageUrl!, defaultPreset)} className="text-xs text-blue-500 hover:underline mt-2">Try Again</button>
 </>
 )}
 </div>
 )}
 </div>
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



