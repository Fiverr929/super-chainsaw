'use client';

import { useEffect, useRef, useState } from 'react';
import { loadImage } from '@/lib/mask-test/canvasAlpha';

type BrushMode = 'erase' | 'restore';

export default function MaskRefiner({ original, value, onChange }: { original: string; value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoRef = useRef<string[]>([]);
  const [mode, setMode] = useState<BrushMode>('erase');
  const [brushSize, setBrushSize] = useState(36);
  const [ready, setReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    Promise.all([loadImage(original), loadImage(value)]).then(([source, cutout]) => {
      if (cancelled) return;
      if (source.naturalWidth !== cutout.naturalWidth || source.naturalHeight !== cutout.naturalHeight) {
        setError('Brush editing is unavailable because this cutout has been cropped.');
        return;
      }
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        setError('Canvas editing is unavailable in this browser.');
        return;
      }
      canvas.width = cutout.naturalWidth;
      canvas.height = cutout.naturalHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(cutout, 0, 0);
      originalRef.current = source;
      setReady(true);
    }).catch(() => { if (!cancelled) setError('Could not load this image for brush editing.'); });
    return () => { cancelled = true; };
  }, [original, value]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * event.currentTarget.width / rect.width,
      y: (event.clientY - rect.top) * event.currentTarget.height / rect.height,
    };
  };

  const draw = (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (mode === 'erase') {
      context.save();
      context.globalCompositeOperation = 'destination-out';
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.lineWidth = brushSize;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
      context.restore();
      return;
    }
    const source = originalRef.current;
    if (!source) return;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, brushSize * 0.35)));
    for (let step = 0; step <= steps; step++) {
      const fraction = step / steps;
      const x = from.x + (to.x - from.x) * fraction;
      const y = from.y + (to.y - from.y) * fraction;
      context.save();
      context.beginPath();
      context.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      context.clip();
      context.globalCompositeOperation = 'source-over';
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      context.restore();
    }
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext('2d');
    if (!context) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    undoRef.current.push(canvas.toDataURL('image/png'));
    if (undoRef.current.length > 5) undoRef.current.shift();
    setCanUndo(true);
    lastPointRef.current = point(event);
    draw(context, canvas, lastPointRef.current, lastPointRef.current);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext('2d');
    const from = lastPointRef.current;
    if (!context || !from || !canvas.hasPointerCapture(event.pointerId)) return;
    const to = point(event);
    draw(context, canvas, from, to);
    lastPointRef.current = to;
  };

  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    if (!lastPointRef.current) return;
    lastPointRef.current = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    onChange(canvas.toDataURL('image/png'));
  };

  const undo = async () => {
    const previous = undoRef.current.pop();
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!previous || !canvas || !context) return;
    setCanUndo(undoRef.current.length > 0);
    const image = await loadImage(previous);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    onChange(previous);
  };

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-zinc-700">Refine edges</span>
      <button type="button" aria-pressed={mode === 'erase'} onClick={() => setMode('erase')} className={`border px-2 py-1 ${mode === 'erase' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-zinc-300'}`}>Erase background</button>
      <button type="button" aria-pressed={mode === 'restore'} onClick={() => setMode('restore')} className={`border px-2 py-1 ${mode === 'restore' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-zinc-300'}`}>Restore design</button>
      <label className="flex items-center gap-2">Brush <input aria-label="Brush size" type="range" min="4" max="160" step="2" value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} /><span className="w-8 text-right">{brushSize}px</span></label>
      <button type="button" disabled={!ready || !canUndo} onClick={() => void undo()} className="border border-zinc-300 px-2 py-1 disabled:opacity-40">Undo stroke</button>
    </div>
    {error ? <p role="status" className="text-xs text-amber-800">{error}</p> : <div className="overflow-auto rounded border border-zinc-200" style={{ ...{ backgroundImage: 'linear-gradient(45deg,#e4e4e7 25%,transparent 25%),linear-gradient(-45deg,#e4e4e7 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e4e4e7 75%),linear-gradient(-45deg,transparent 75%,#e4e4e7 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0' } }}>
      <canvas ref={canvasRef} aria-label="Paint to erase background or restore original design pixels" className="mx-auto block h-auto max-h-[calc(100vh-220px)] max-w-full touch-none cursor-crosshair" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
    </div>}
    {!error && <p className="text-[11px] text-zinc-500">{mode === 'erase' ? 'Paint over leftover background to make it transparent.' : 'Paint over missing details to restore their original pixels.'} Brush edits stay on this device.</p>}
  </div>;
}
