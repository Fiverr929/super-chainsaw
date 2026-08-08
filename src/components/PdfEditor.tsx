"use client";

import React, { useState, useRef } from "react";
import { PDFDocument } from "pdf-lib";
import { Document, Page, pdfjs } from "react-pdf";
import { UploadCloud, Trash2, Layers, X, ArrowLeft, ArrowRight, Scissors, Eye, GripVertical, Image as ImageIcon, FilePlus2 } from "lucide-react";
import toast from "react-hot-toast";
import JSZip from "jszip";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface WorkspacePage {
  id: string; // unique page instance id
  originalPageIndex: number;
  isExcluded: boolean;
  isSplitAfter: boolean;
}

interface PdfFile {
  id: string;
  name: string;
  file: File;
  numPages: number;
  previewUrl: string;
  pages: WorkspacePage[];
}

interface ImageFile {
  id: string;
  name: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to read ${file.name}`));
    };
    image.src = url;
  });
}

export default function PdfEditor() {
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isConvertingImages, setIsConvertingImages] = useState(false);
  const [previewPage, setPreviewPage] = useState<{fileId: string, pageIndex: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: PdfFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== "application/pdf") {
        toast.error(`${file.name} is not a PDF`);
        continue;
      }
      
      const arrayBuffer = await file.arrayBuffer();
      let numPages = 0;
      try {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        numPages = pdfDoc.getPageCount();
      } catch {
        toast.error(`Failed to read ${file.name}`);
        continue;
      }

      const pages: WorkspacePage[] = Array.from(new Array(numPages), (_, index) => ({
        id: Math.random().toString(36).substring(7),
        originalPageIndex: index,
        isExcluded: false,
        isSplitAfter: false,
      }));

      newFiles.push({
        id: Math.random().toString(36).substring(7),
        name: file.name,
        file: file,
        numPages,
        previewUrl: URL.createObjectURL(file),
        pages,
      });
    }

    setPdfFiles((prev) => {
      const combined = [...prev, ...newFiles];
      if (prev.length === 0 && newFiles.length > 0) {
        setActiveFileId(newFiles[0].id);
      }
      return combined;
    });
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newImages: ImageFile[] = [];
    for (const file of files) {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        toast.error(`${file.name} is not a JPG or PNG`);
        continue;
      }

      try {
        const dimensions = await loadImageDimensions(file);
        newImages.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          file,
          previewUrl: URL.createObjectURL(file),
          width: dimensions.width,
          height: dimensions.height,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to read ${file.name}`);
      }
    }

    setImageFiles(prev => [...prev, ...newImages]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setPdfFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.previewUrl);
      const newFiles = prev.filter((f) => f.id !== id);
      if (activeFileId === id) {
        setActiveFileId(newFiles.length > 0 ? newFiles[0].id : null);
      }
      return newFiles;
    });
  };

  const removeImage = (id: string) => {
    setImageFiles(prev => {
      const image = prev.find(item => item.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return prev.filter(item => item.id !== id);
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedFileId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedFileId || draggedFileId === targetId) return;
    
    setPdfFiles(prev => {
      const newFiles = [...prev];
      const draggedIndex = newFiles.findIndex(f => f.id === draggedFileId);
      const targetIndex = newFiles.findIndex(f => f.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const [draggedFile] = newFiles.splice(draggedIndex, 1);
      newFiles.splice(targetIndex, 0, draggedFile);
      return newFiles;
    });
    setDraggedFileId(null);
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
  };

  const handleImageDragStart = (e: React.DragEvent, id: string) => {
    setDraggedImageId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleImageDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedImageId || draggedImageId === targetId) return;

    setImageFiles(prev => {
      const next = [...prev];
      const draggedIndex = next.findIndex(item => item.id === draggedImageId);
      const targetIndex = next.findIndex(item => item.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      const [draggedImage] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, draggedImage);
      return next;
    });
    setDraggedImageId(null);
  };

  const handleImageDragEnd = () => {
    setDraggedImageId(null);
  };

  const movePage = (fileId: string, pageId: string, direction: 'left' | 'right') => {
    setPdfFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const pages = [...f.pages];
      const idx = pages.findIndex(p => p.id === pageId);
      if (idx === -1) return f;
      
      if (direction === 'left' && idx > 0) {
        const temp = pages[idx];
        pages[idx] = pages[idx - 1];
        pages[idx - 1] = temp;
      } else if (direction === 'right' && idx < pages.length - 1) {
        const temp = pages[idx];
        pages[idx] = pages[idx + 1];
        pages[idx + 1] = temp;
      }
      return { ...f, pages };
    }));
  };

  const toggleExclude = (fileId: string, pageId: string) => {
    setPdfFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return {
        ...f,
        pages: f.pages.map(p => p.id === pageId ? { ...p, isExcluded: !p.isExcluded } : p)
      };
    }));
  };

  const toggleSplit = (fileId: string, pageId: string) => {
    setPdfFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return {
        ...f,
        pages: f.pages.map(p => p.id === pageId ? { ...p, isSplitAfter: !p.isSplitAfter } : p)
      };
    }));
  };

  const handleMerge = async () => {
    if (pdfFiles.length === 0) return;
    setIsMerging(true);
    
    const mergePromise = (async () => {
      let currentDoc = await PDFDocument.create();
      const outputDocs: Uint8Array[] = [];
      let hasAddedPagesToCurrent = false;

      for (const pdfFile of pdfFiles) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer);
        
        for (const page of pdfFile.pages) {
          if (page.isExcluded) continue;
          
          const [copiedPage] = await currentDoc.copyPages(srcDoc, [page.originalPageIndex]);
          currentDoc.addPage(copiedPage);
          hasAddedPagesToCurrent = true;

          if (page.isSplitAfter) {
            outputDocs.push(await currentDoc.save());
            currentDoc = await PDFDocument.create();
            hasAddedPagesToCurrent = false;
          }
        }
      }

      if (hasAddedPagesToCurrent) {
        outputDocs.push(await currentDoc.save());
      }

      if (outputDocs.length === 0) {
        throw new Error("No pages left to merge. Please un-delete at least one page.");
      }

      if (outputDocs.length === 1) {
        const blob = new Blob([outputDocs[0] as unknown as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "merged_workspace_document.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const zip = new JSZip();
        outputDocs.forEach((docBytes, i) => {
          zip.file(`split_document_${i + 1}.pdf`, docBytes);
        });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "workspace_documents.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    })();

    toast.promise(mergePromise, {
      loading: "Processing PDFs...",
      success: "PDFs processed and downloaded successfully!",
      error: (err) => err.message || "An error occurred while processing PDFs."
    });

    try {
      await mergePromise;
    } finally {
      setIsMerging(false);
    }
  };

  const handleImagesToPdf = async () => {
    if (imageFiles.length === 0) return;
    setIsConvertingImages(true);

    const convertPromise = (async () => {
      const pdfDoc = await PDFDocument.create();

      for (const imageFile of imageFiles) {
        const imageBytes = await imageFile.file.arrayBuffer();
        const image = imageFile.file.type === "image/png"
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);

        const page = pdfDoc.addPage([imageFile.width, imageFile.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: imageFile.width,
          height: imageFile.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = imageFiles.length === 1 ? "image_to_pdf.pdf" : "images_to_pdf.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })();

    toast.promise(convertPromise, {
      loading: "Converting images to PDF...",
      success: "Images converted to PDF.",
      error: (err) => err.message || "Failed to convert images."
    });

    try {
      await convertPromise;
    } finally {
      setIsConvertingImages(false);
    }
  };

  const activeFile = pdfFiles.find(f => f.id === activeFileId);

  return (
    <div className="h-full flex flex-col bg-zinc-50 overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white flex justify-between items-center z-10 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-800">PDF Manager</h1>
          <p className="text-sm text-zinc-500">Merge, split, and reorder PDF files in the PDF Manager</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png"
            className="hidden"
            ref={imageInputRef}
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-300 text-zinc-700  hover:bg-zinc-50 transition-colors font-medium text-sm"
          >
            <UploadCloud size={18} />
            Upload PDFs
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-300 text-zinc-700  hover:bg-zinc-50 transition-colors font-medium text-sm"
          >
            <ImageIcon size={18} />
            Images to PDF
          </button>
          
          <button
            onClick={handleMerge}
            disabled={pdfFiles.length === 0 || isMerging}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white  hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Layers size={18} />
            {isMerging ? "Processing..." : "Export"}
          </button>
        </div>
      </div>

      {/* Main Workspace Area (Two Columns) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Page Grid for Active File */}
        <div className="flex-1 overflow-y-auto p-6 relative bg-zinc-50/50">
          {pdfFiles.length === 0 && imageFiles.length > 0 ? (
            <div className="max-w-5xl mx-auto pb-12">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-800">Images to PDF</h2>
                  <p className="text-sm text-zinc-500">Drag images to reorder pages, then export one PDF.</p>
                </div>
                <button
                  onClick={handleImagesToPdf}
                  disabled={imageFiles.length === 0 || isConvertingImages}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <FilePlus2 size={18} />
                  {isConvertingImages ? "Converting..." : "Convert to PDF"}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {imageFiles.map((image, index) => (
                  <div
                    key={image.id}
                    draggable
                    onDragStart={(event) => handleImageDragStart(event, image.id)}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleImageDrop(event, image.id)}
                    onDragEnd={handleImageDragEnd}
                    className={`bg-white border shadow-sm overflow-hidden group ${draggedImageId === image.id ? "opacity-50 scale-[0.98]" : "border-zinc-200 hover:border-blue-400"}`}
                  >
                    <div className="relative aspect-[3/4] bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.previewUrl} alt={image.name} className="w-full h-full object-contain" />
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 text-zinc-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="p-3 flex items-start gap-2">
                      <GripVertical size={14} className="mt-0.5 text-zinc-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-800 truncate" title={image.name}>{image.name}</div>
                        <div className="text-[11px] text-zinc-500">{image.width} x {image.height}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : pdfFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-300  bg-white/50 shadow-sm max-w-2xl mx-auto">
              <div className="p-4 bg-blue-50 text-blue-500  mb-4">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-lg font-semibold text-zinc-700 mb-2">No files uploaded yet</h3>
              <p className="text-zinc-500 mb-6 max-w-sm text-center">Upload PDFs to merge/split, or upload JPG/PNG images to create a PDF.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-zinc-900 text-white hover:bg-zinc-800 transition-colors font-medium shadow-sm"
                >
                  Select PDFs
                </button>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="px-5 py-2.5 bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors font-medium shadow-sm"
                >
                  Select Images
                </button>
              </div>
            </div>
          ) : !activeFile ? (
            <div className="h-full flex items-center justify-center text-zinc-400">
              Select a file from the sidebar to view its pages.
            </div>
          ) : (
            <div className="max-w-6xl mx-auto pb-12">
              <div className="mb-6 flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-zinc-800">{activeFile.name}</h2>
                <span className="text-xs font-medium text-zinc-500 bg-zinc-200/60 px-2 py-1 ">
                  {activeFile.pages.length} pages
                </span>
              </div>
              
              <Document
                file={activeFile.previewUrl}
                loading={<div className="text-zinc-400 text-sm animate-pulse h-32 flex items-center justify-center">Loading document...</div>}
                className="flex flex-wrap gap-6"
              >
                {activeFile.pages.map((page, index) => {
                  return (
                    <div key={page.id} className="relative flex items-center">
                      {/* Page Thumbnail */}
                      <div 
                        className={`relative group  overflow-hidden border-2 transition-all shadow-sm shrink-0 bg-white ${
                          page.isExcluded 
                            ? "border-red-400 opacity-50 grayscale-[30%]" 
                            : "border-zinc-200 hover:border-blue-400 hover:shadow-md"
                        }`}
                      >
                        <div className="pointer-events-none">
                          <Page
                            pageNumber={page.originalPageIndex + 1}
                            width={160}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={<div className="w-[160px] h-[226px] bg-zinc-100 animate-pulse" />}
                          />
                        </div>
                        
                        {/* Page Number Badge */}
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5  backdrop-blur-md">
                          {index + 1}
                        </div>
                        
                        {/* Hover Controls */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                          {/* Reorder Arrows */}
                          <div className="flex gap-4">
                            <button 
                              onClick={() => movePage(activeFile.id, page.id, 'left')}
                              disabled={index === 0}
                              className="text-white hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white"
                              title="Move Left"
                            >
                              <ArrowLeft size={24} />
                            </button>
                            <button 
                              onClick={() => setPreviewPage({fileId: activeFile.id, pageIndex: page.originalPageIndex})}
                              className="text-white hover:text-blue-400"
                              title="Preview Page"
                            >
                              <Eye size={24} />
                            </button>
                            <button 
                              onClick={() => movePage(activeFile.id, page.id, 'right')}
                              disabled={index === activeFile.pages.length - 1}
                              className="text-white hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white"
                              title="Move Right"
                            >
                              <ArrowRight size={24} />
                            </button>
                          </div>
                          
                          {/* Action Badges */}
                          <button 
                            onClick={() => toggleExclude(activeFile.id, page.id)}
                            className={`px-3 py-1.5  text-xs font-semibold flex items-center gap-1.5 transition-colors mt-2 ${
                              page.isExcluded ? 'bg-red-500 text-white' : 'bg-white text-zinc-700 hover:bg-red-50 hover:text-red-500'
                            }`}
                          >
                            <Trash2 size={14} /> {page.isExcluded ? 'Excluded' : 'Exclude'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Split Point Divider */}
                      {index < activeFile.pages.length - 1 && (
                        <div className="relative mx-3 shrink-0 h-full flex items-center justify-center w-8 group">
                          <div className={`absolute top-0 bottom-0 w-px border-l-2 border-dashed ${page.isSplitAfter ? 'border-orange-500' : 'border-zinc-200 group-hover:border-orange-300'}`} />
                          <button 
                            onClick={() => toggleSplit(activeFile.id, page.id)}
                            className={`z-10 p-1.5  shadow-sm border transition-colors ${
                              page.isSplitAfter 
                                ? 'bg-orange-500 border-orange-600 text-white' 
                                : 'bg-white border-zinc-200 text-zinc-400 group-hover:text-orange-400 group-hover:border-orange-300'
                            }`}
                            title="Split document here"
                          >
                            <Scissors size={14} className={page.isSplitAfter ? '' : 'rotate-90'} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Document>
            </div>
          )}
        </div>

        {/* Right Pane: Compact File Manager Sidebar (Drag & Drop) */}
        {(pdfFiles.length > 0 || imageFiles.length > 0) && (
          <div className="w-64 bg-white border-l border-zinc-200 flex flex-col shrink-0 z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.03)] text-sm">
            {pdfFiles.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
                  <span className="font-semibold text-zinc-700">Files</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                    {pdfFiles.length} item{pdfFiles.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className={`${imageFiles.length > 0 ? "max-h-[45%]" : "flex-1"} overflow-y-auto p-2 space-y-1`}>
                  {pdfFiles.map((file) => {
                    const isActive = activeFileId === file.id;
                    const isDragged = draggedFileId === file.id;
                    
                    return (
                      <div 
                        key={file.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, file.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, file.id)}
                        onDragEnd={handleDragEnd}
                        className={`p-2  border transition-all cursor-pointer flex items-center gap-2 group relative overflow-hidden ${
                          isDragged ? 'opacity-50 scale-[0.98]' : ''
                        } ${
                          isActive 
                            ? 'border-blue-400 bg-blue-50/50 shadow-sm ring-1 ring-blue-400/20' 
                            : 'border-transparent bg-white hover:border-zinc-200 hover:bg-zinc-50'
                        }`}
                        onClick={() => setActiveFileId(file.id)}
                      >
                        {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500 " />}
                        <div className="text-zinc-300 group-hover:text-zinc-500 cursor-grab active:cursor-grabbing shrink-0 pl-1">
                          <GripVertical size={14} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <span className="font-medium text-zinc-800 truncate" title={file.name}>{file.name}</span>
                          <span className="text-[10px] text-zinc-500">{file.pages.length} pages</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 shrink-0 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                          title="Remove file completely"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="p-3 border-t border-zinc-100 bg-zinc-50/50">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-1.5 bg-white border border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-colors font-medium text-xs shadow-sm"
                  >
                    <UploadCloud size={14} />
                    Add More PDFs
                  </button>
                </div>
              </>
            )}

            {imageFiles.length > 0 && (
              <>
                <div className="px-3 py-2 border-y border-zinc-100 bg-zinc-50 flex items-center justify-between">
                  <span className="font-semibold text-zinc-700">Images</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                    {imageFiles.length} page{imageFiles.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {imageFiles.map((image, index) => (
                    <div
                      key={image.id}
                      draggable
                      onDragStart={(event) => handleImageDragStart(event, image.id)}
                      onDragOver={handleDragOver}
                      onDrop={(event) => handleImageDrop(event, image.id)}
                      onDragEnd={handleImageDragEnd}
                      className={`p-2 border flex items-center gap-2 group bg-white hover:bg-zinc-50 ${draggedImageId === image.id ? "opacity-50 scale-[0.98]" : "border-transparent hover:border-zinc-200"}`}
                    >
                      <GripVertical size={14} className="text-zinc-300 shrink-0" />
                      <div className="w-8 h-10 bg-zinc-100 border border-zinc-100 shrink-0 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.previewUrl} alt={image.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-800 truncate">{index + 1}. {image.name}</div>
                        <div className="text-[10px] text-zinc-500">{image.width} x {image.height}</div>
                      </div>
                      <button
                        onClick={() => removeImage(image.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove image"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 space-y-2">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-1.5 bg-white border border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-colors font-medium text-xs shadow-sm"
                  >
                    <ImageIcon size={14} />
                    Add Images
                  </button>
                  <button
                    onClick={handleImagesToPdf}
                    disabled={imageFiles.length === 0 || isConvertingImages}
                    className="w-full flex items-center justify-center gap-2 py-1.5 bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm disabled:opacity-50"
                  >
                    <FilePlus2 size={14} />
                    {isConvertingImages ? "Converting..." : "Convert Images"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewPage && (
        <div className="fixed inset-0 bg-zinc-900/90 z-50 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center p-4 bg-black/20 text-white">
            <h3 className="font-medium text-zinc-200">Page Preview</h3>
            <button 
              onClick={() => setPreviewPage(null)}
              className="p-2 hover:bg-white/10  transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-8">
            {(() => {
              const file = pdfFiles.find(f => f.id === previewPage.fileId);
              if (!file) return null;
              return (
                <Document 
                  file={file.previewUrl}
                  loading={<div className="text-zinc-400 animate-pulse">Loading high-res preview...</div>}
                >
                  <div className="bg-white  shadow-2xl overflow-hidden">
                    <Page 
                      pageNumber={previewPage.pageIndex + 1} 
                      width={Math.min(window.innerWidth - 64, 1000)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </div>
                </Document>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
