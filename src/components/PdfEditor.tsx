"use client";

import React, { useState, useRef, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { Document, Page, pdfjs } from "react-pdf";
import { UploadCloud, Trash2, Layers, X, ArrowLeft, ArrowRight, Scissors, Eye, GripVertical } from "lucide-react";
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
  const [mode, setMode] = useState<"pdf" | "images">("pdf");
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
  const previewUrls = useRef(new Set<string>());

  const createPreviewUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    previewUrls.current.add(url);
    return url;
  };

  useEffect(() => () => {
    previewUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: PdfFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
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
        previewUrl: createPreviewUrl(file),
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
    if (newFiles.length > 0) setMode("pdf");
    
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
          previewUrl: createPreviewUrl(file),
          width: dimensions.width,
          height: dimensions.height,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to read ${file.name}`);
      }
    }

    setImageFiles(prev => [...prev, ...newImages]);
    if (newImages.length > 0) setMode("images");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setPdfFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.previewUrl);
        previewUrls.current.delete(file.previewUrl);
      }
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
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
        previewUrls.current.delete(image.previewUrl);
      }
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
    } catch {
      // toast.promise reports the actionable error.
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
    } catch {
      // toast.promise reports the actionable error.
    } finally {
      setIsConvertingImages(false);
    }
  };

  const activeFile = pdfFiles.find(f => f.id === activeFileId);

  return (
    <div className="h-full flex flex-col bg-zinc-50 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50 flex flex-wrap justify-between items-center gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">PDF tools</h1>
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
          <div className="flex border-b border-zinc-200 text-sm" role="tablist" aria-label="PDF tools">
            <button type="button" role="tab" aria-selected={mode === "pdf"} onClick={() => setMode("pdf")} className={`px-3 py-2 ${mode === "pdf" ? "border-b-2 border-zinc-900 font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}>Merge PDFs</button>
            <button type="button" role="tab" aria-selected={mode === "images"} onClick={() => setMode("images")} className={`px-3 py-2 ${mode === "images" ? "border-b-2 border-zinc-900 font-medium text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}>Images to PDF</button>
          </div>
          <button onClick={() => (mode === "pdf" ? fileInputRef : imageInputRef).current?.click()} className="flex items-center gap-2 border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"><UploadCloud size={16} /> Add {mode === "pdf" ? "PDFs" : "images"}</button>
          <button onClick={mode === "pdf" ? handleMerge : handleImagesToPdf} disabled={mode === "pdf" ? pdfFiles.length === 0 || isMerging : imageFiles.length === 0 || isConvertingImages} className="flex items-center gap-2 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"><Layers size={16} />{isMerging || isConvertingImages ? "Working..." : mode === "pdf" ? "Download PDF" : "Create PDF"}</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 bg-zinc-50">
          {mode === "images" && imageFiles.length > 0 ? (
            <div className="max-w-5xl mx-auto pb-12">
              <p className="mb-4 text-sm text-zinc-500">Drag images to change page order.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {imageFiles.map((image, index) => (
                  <div
                    key={image.id}
                    draggable
                    onDragStart={(event) => handleImageDragStart(event, image.id)}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleImageDrop(event, image.id)}
                    onDragEnd={handleImageDragEnd}
                    className={`bg-white border overflow-hidden ${draggedImageId === image.id ? "opacity-50" : "border-zinc-200"}`}
                  >
                    <div className="relative aspect-[3/4] bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.previewUrl} alt={image.name} className="w-full h-full object-contain" />
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute top-2 right-2 p-1.5 bg-white text-zinc-600 hover:text-red-600"
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
          ) : (mode === "pdf" ? pdfFiles.length === 0 : imageFiles.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center border border-dashed border-zinc-300 bg-white max-w-2xl mx-auto">
              <UploadCloud size={28} className="mb-4 text-zinc-400" />
              <h3 className="text-lg font-semibold text-zinc-700 mb-2">{mode === "pdf" ? "Add PDFs to get started" : "Add images to get started"}</h3>
              <p className="text-zinc-500 mb-6 max-w-sm text-center">{mode === "pdf" ? "Arrange files and pages, then download one PDF." : "Arrange JPG or PNG images, then create a PDF."}</p>
              <button onClick={() => (mode === "pdf" ? fileInputRef : imageInputRef).current?.click()} className="bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">Choose {mode === "pdf" ? "PDFs" : "images"}</button>
            </div>
          ) : !activeFile ? (
            <div className="h-full flex items-center justify-center text-zinc-400">
              Select a file from the sidebar to view its pages.
            </div>
          ) : (
            <div className="max-w-6xl mx-auto pb-12">
              <div className="mb-6 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-zinc-800">{activeFile.name}</h2>
                <span className="text-xs text-zinc-500">
                  {activeFile.pages.length} pages
                </span>
              </div>
              
              <p className="mb-4 text-sm text-zinc-500">Use the arrows to reorder pages. Exclude a page or split after it if needed.</p>
              <Document
                file={activeFile.previewUrl}
                loading={<div className="text-zinc-400 text-sm animate-pulse h-32 flex items-center justify-center">Loading document...</div>}
                className="flex flex-wrap gap-4"
              >
                {activeFile.pages.map((page, index) => {
                  return (
                    <div key={page.id} className="relative flex items-center">
                      <div 
                        className={`relative overflow-hidden border shrink-0 bg-white ${
                          page.isExcluded 
                            ? "border-zinc-300 opacity-60"
                            : "border-zinc-200"
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
                        
                        <div className="absolute top-2 left-2 bg-white border border-zinc-200 text-zinc-700 text-xs px-2 py-0.5">
                          {index + 1}
                        </div>
                        <div className="flex items-center justify-between border-t border-zinc-200 px-2 py-1.5 text-zinc-600">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => movePage(activeFile.id, page.id, 'left')}
                              disabled={index === 0}
                              className="p-1 hover:bg-zinc-100 disabled:opacity-30"
                              title="Move left"
                            >
                              <ArrowLeft size={16} />
                            </button>
                            <button 
                              onClick={() => setPreviewPage({fileId: activeFile.id, pageIndex: page.originalPageIndex})}
                              className="p-1 hover:bg-zinc-100"
                              title="Preview page"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => movePage(activeFile.id, page.id, 'right')}
                              disabled={index === activeFile.pages.length - 1}
                              className="p-1 hover:bg-zinc-100 disabled:opacity-30"
                              title="Move right"
                            >
                              <ArrowRight size={16} />
                            </button>
                          </div>
                          <button 
                            onClick={() => toggleExclude(activeFile.id, page.id)}
                            className={`p-1 text-xs ${page.isExcluded ? 'text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-900'}`}
                          >
                            {page.isExcluded ? 'Include' : 'Exclude'}
                          </button>
                        </div>
                      </div>
                      
                      {index < activeFile.pages.length - 1 && (
                        <div className="mx-2 shrink-0 flex items-center justify-center">
                          <button 
                            onClick={() => toggleSplit(activeFile.id, page.id)}
                            className={`p-1.5 border ${
                              page.isSplitAfter 
                                ? 'bg-zinc-900 border-zinc-900 text-white'
                                : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                            }`}
                            title={page.isSplitAfter ? "Remove split" : "Split after this page"}
                          >
                            <Scissors size={14} />
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

        {mode === "pdf" && pdfFiles.length > 0 && (
          <div className="w-64 bg-white border-l border-zinc-200 flex flex-col shrink-0 text-sm">
                <div className="px-4 py-3 border-b border-zinc-200 font-medium text-zinc-800">Files · {pdfFiles.length}</div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                        className={`p-2 border cursor-pointer flex items-center gap-2 relative ${
                          isDragged ? 'opacity-50' : ''
                        } ${
                          isActive 
                            ? 'border-zinc-300 bg-zinc-100'
                            : 'border-transparent bg-white hover:bg-zinc-50'
                        }`}
                        onClick={() => setActiveFileId(file.id)}
                      >
                        <div className="text-zinc-400 cursor-grab active:cursor-grabbing shrink-0 pl-1">
                          <GripVertical size={14} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <span className="font-medium text-zinc-800 truncate" title={file.name}>{file.name}</span>
                          <span className="text-[10px] text-zinc-500">{file.pages.length} pages</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                          className="p-1.5 text-zinc-500 hover:text-red-600 shrink-0"
                          title="Remove file completely"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
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
