import { useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useActiveIndex } from '@/hooks/use-active-index';
import { useZoomPan } from '@/hooks/use-zoom-pan';
import { getOptimizedImageUrl, buildSrcSet } from '@/lib/productImage';

const VIEWER_WIDTHS = [828, 1080, 1280, 1600, 2000, 2560, 3200];

interface ProductFullscreenViewerProps {
  images: string[];
  open: boolean;
  startIndex: number;
  onOpenChange: (open: boolean) => void;
  productName: string;
}

/** A single image inside the vertical-scroll viewer — owns its own zoom/pan state, independent of
 * whichever image is currently active, so scrolling to another image never carries zoom state along. */
const ZoomableImage = ({ src, alt }: { src: string; alt: string }) => {
  const { imgRef, scale, translate, isDragging, zoomed, handlers } = useZoomPan();

  return (
    <img
      ref={imgRef}
      src={getOptimizedImageUrl(src, 1600, 'hi')}
      srcSet={buildSrcSet(src, VIEWER_WIDTHS, 'hi')}
      sizes="100vw"
      alt={alt}
      draggable={false}
      className={`block w-full h-screen object-cover lg:h-auto lg:object-fill select-none ${
        zoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
      }`}
      style={{
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
        transformOrigin: 'center',
        transition: isDragging ? 'none' : 'transform 200ms ease-out',
        touchAction: zoomed ? 'none' : 'auto',
      }}
      {...handlers}
    />
  );
};

const ProductFullscreenViewer = ({
  images,
  open,
  startIndex,
  onOpenChange,
  productName,
}: ProductFullscreenViewerProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const activeIndex = useActiveIndex(scrollContainerRef, itemRefs, images.length);

  const scrollToIndex = (index: number, behavior: ScrollBehavior) => {
    itemRefs.current[index]?.scrollIntoView({ behavior, block: 'start' });
  };

  // Jump to the clicked image the instant the viewer opens — no animation, no flash of image 0.
  // On desktop, slide height is the image's own natural size (no forced h-screen), so scrollIntoView's
  // target position depends on every PRECEDING image having already loaded/decoded — jumping before
  // that finishes lands short (their collapsed 0-height layout makes image N look like it's near the
  // top). Wait for images 0..startIndex to decode first, so the jump lands on the real position.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const imagesToAwait = itemRefs.current
      .slice(0, startIndex + 1)
      .map((el) => el?.querySelector('img'))
      .filter((img): img is HTMLImageElement => !!img);

    Promise.all(
      imagesToAwait.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
    ).then(() => {
      if (!cancelled) scrollToIndex(startIndex, 'auto');
    });

    return () => {
      cancelled = true;
    };
  }, [open, startIndex]);

  // ArrowDown/ArrowUp move between images; Escape-to-close is Radix Dialog's default behavior.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToIndex(Math.min(activeIndex + 1, images.length - 1), 'smooth');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToIndex(Math.max(activeIndex - 1, 0), 'smooth');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, activeIndex, images.length]);

  if (images.length === 0) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 w-screen h-screen data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <DialogPrimitive.Title className="sr-only">
            {productName} — image gallery
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Scroll to browse images. Click an image to zoom, then drag to pan. Press Escape to close.
          </DialogPrimitive.Description>

          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 lg:right-6 lg:top-6 z-20 p-2 rounded-full bg-background/80 hover:bg-background transition-colors">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Main viewer — vertical scroll through all images.
              Mobile (<lg): each slide is exactly one screen, image fills it edge to edge (no white
              gutter above/below) via object-cover — a slight crop on whichever axis the photo doesn't
              match the screen's aspect ratio, same tradeoff full-bleed mobile PDPs make everywhere.
              Desktop (lg+): images run full width edge to edge at their natural aspect ratio (no crop),
              zero gap between them, scrolling through a tall image reveals more of it before the next
              begins. */}
          <div ref={scrollContainerRef} className="h-full w-full overflow-y-auto overscroll-contain">
            {images.map((imageUrl, index) => (
              <div
                key={index}
                ref={(el) => (itemRefs.current[index] = el)}
                className="relative h-screen w-full overflow-hidden lg:h-auto"
              >
                <ZoomableImage src={imageUrl} alt={`${productName} - View ${index + 1}`} />
              </div>
            ))}
          </div>

          {/* Thumbnail rail — floats directly on top of the image, vertically centered, no separate
              column/gutter. Edge-to-edge (no gap/padding between thumbnails); active state is an inset
              ring rather than a border, since a border would eat into the flush layout. Scrollable so
              it still works cleanly with more than a handful of images. */}
          {images.length > 1 && (
            <div className="absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 z-10 flex max-h-[70vh] w-16 flex-col overflow-y-auto shadow-lg sm:w-20 md:w-24 lg:w-28">
              {images.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => scrollToIndex(index, 'smooth')}
                  className={`aspect-[3/4] w-full overflow-hidden flex-shrink-0 transition-opacity ${
                    activeIndex === index
                      ? 'opacity-100 ring-2 ring-inset ring-foreground'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getOptimizedImageUrl(imageUrl, 160)}
                    alt={`${productName} thumbnail ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ProductFullscreenViewer;
