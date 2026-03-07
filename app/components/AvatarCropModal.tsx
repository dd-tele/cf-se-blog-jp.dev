import { useState, useRef, useCallback, useEffect } from "react";

interface AvatarCropModalProps {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onClose: () => void;
}

const CANVAS_SIZE = 300;
const CIRCLE_RADIUS = 130;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

export function AvatarCropModal({ imageSrc, onCrop, onClose }: AvatarCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Fit image so shorter side fills the circle
      const fitScale = (CIRCLE_RADIUS * 2) / Math.min(img.width, img.height);
      setScale(fitScale);
      setOffset({ x: 0, y: 0 });
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw preview
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw image centered + offset + scaled
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2 + offset.x, cy - h / 2 + offset.y, w, h);

    // Draw dark overlay with circular cutout
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();

    // Draw circle border
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CIRCLE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [scale, offset]);

  useEffect(() => {
    if (imageLoaded) draw();
  }, [imageLoaded, draw]);

  // Mouse/touch handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev - e.deltaY * 0.001)));
  }, []);

  // Crop and export
  const handleCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;

    const outputSize = 400;
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = outputSize;
    cropCanvas.height = outputSize;
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) return;

    // Calculate crop area: map the circle region to the output canvas
    const ratio = outputSize / (CIRCLE_RADIUS * 2);
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const w = img.width * scale;
    const h = img.height * scale;
    const imgX = cx - w / 2 + offset.x;
    const imgY = cy - h / 2 + offset.y;

    // Translate so circle center = output center
    ctx.save();
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      img,
      (imgX - (cx - CIRCLE_RADIUS)) * ratio,
      (imgY - (cy - CIRCLE_RADIUS)) * ratio,
      w * ratio,
      h * ratio
    );
    ctx.restore();

    cropCanvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      "image/png",
      1
    );
  }, [scale, offset, onCrop]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-center text-base font-bold text-gray-900">写真の位置を調整</h3>
        <p className="mb-3 text-center text-xs text-gray-500">
          ドラッグで位置を調整、スライダーで拡大/縮小できます
        </p>

        <div className="mx-auto mb-4 flex justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="rounded-xl border border-gray-200 touch-none"
            style={{ cursor: dragging ? "grabbing" : "grab", maxWidth: "100%", height: "auto" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          />
        </div>

        {/* Zoom slider */}
        <div className="mb-5 flex items-center gap-3 px-2">
          <span className="text-xs text-gray-400">−</span>
          <input
            type="range"
            min={MIN_SCALE * 100}
            max={MAX_SCALE * 100}
            value={scale * 100}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
            className="flex-1 accent-brand-500"
          />
          <span className="text-xs text-gray-400">+</span>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleCrop}
            className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            この位置で決定
          </button>
        </div>
      </div>
    </div>
  );
}
