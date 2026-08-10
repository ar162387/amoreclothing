import { useCallback, useRef, useState } from 'react';

const ZOOM_SCALE = 2.2;
const CLICK_MOVE_THRESHOLD = 5; // px of pointer movement below which a pointerup counts as a click
const CLICK_TIME_THRESHOLD = 400; // ms

interface Point {
  x: number;
  y: number;
}

/**
 * Click/tap-to-zoom with drag-to-pan for a single image, via native Pointer Events (unifies mouse +
 * touch + pen) and a CSS transform — no zoom/pan library. Click zooms toward the click point; clicking
 * again (without having dragged) zooms back out to the original position. While zoomed, dragging pans
 * the image, clamped so it can never be dragged past its own edge.
 *
 * Used by ProductFullscreenViewer — one instance per image, so zoom state is independent per image.
 */
export function useZoomPan() {
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const zoomed = scale > 1;

  // Unscaled image box, captured the moment we zoom in — used to clamp panning bounds.
  const baseSizeRef = useRef<{ width: number; height: number } | null>(null);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    startTranslate: Point;
    startTime: number;
    moved: boolean;
  } | null>(null);

  const clamp = useCallback((next: Point): Point => {
    const base = baseSizeRef.current;
    if (!base) return next;
    const maxX = Math.max(0, (base.width * (ZOOM_SCALE - 1)) / 2);
    const maxY = Math.max(0, (base.height * (ZOOM_SCALE - 1)) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  const zoomIn = useCallback(
    (clientX: number, clientY: number) => {
      const el = imgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      baseSizeRef.current = { width: rect.width, height: rect.height };
      // Zoom-toward-cursor: keep the clicked point under the cursor after scaling, so clicking a
      // specific garment detail brings that area into focus rather than always zooming to center.
      const offsetX = clientX - (rect.left + rect.width / 2);
      const offsetY = clientY - (rect.top + rect.height / 2);
      setScale(ZOOM_SCALE);
      setTranslate(clamp({ x: -offsetX * (ZOOM_SCALE - 1), y: -offsetY * (ZOOM_SCALE - 1) }));
    },
    [clamp],
  );

  const zoomOut = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    baseSizeRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // No active pointer with this id (can happen with synthetic events, or a pointer that
        // already ended) — safe to ignore, drag/click tracking below doesn't depend on capture.
      }
      pointerRef.current = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTranslate: translate,
        startTime: Date.now(),
        moved: false,
      };
      if (zoomed) setIsDragging(true);
    },
    [translate, zoomed],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      const drag = pointerRef.current;
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > CLICK_MOVE_THRESHOLD || Math.abs(dy) > CLICK_MOVE_THRESHOLD) {
        drag.moved = true;
      }
      if (!zoomed || !drag.moved) return;
      setTranslate(clamp({ x: drag.startTranslate.x + dx, y: drag.startTranslate.y + dy }));
    },
    [clamp, zoomed],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      const drag = pointerRef.current;
      setIsDragging(false);
      if (!drag || drag.id !== e.pointerId) return;
      pointerRef.current = null;
      const wasClick = !drag.moved && Date.now() - drag.startTime < CLICK_TIME_THRESHOLD;
      if (wasClick) {
        if (zoomed) zoomOut();
        else zoomIn(e.clientX, e.clientY);
      }
    },
    [zoomed, zoomIn, zoomOut],
  );

  const onPointerCancel = useCallback(() => {
    setIsDragging(false);
    pointerRef.current = null;
  }, []);

  return {
    imgRef,
    scale,
    translate,
    isDragging,
    zoomed,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    reset: zoomOut,
  };
}
