import { useState, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel';

interface ProductLightboxProps {
  images: string[];
  open: boolean;
  startIndex: number;
  onOpenChange: (open: boolean) => void;
  productName: string;
}

const ProductLightbox = ({ images, open, startIndex, onOpenChange, productName }: ProductLightboxProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on('select', () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  if (images.length === 0) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 w-screen h-screen flex data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <DialogPrimitive.Title className="sr-only">
            {productName} — image gallery
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Full-screen product image viewer. Use the arrow keys to navigate, or press Escape to close.
          </DialogPrimitive.Description>

          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 lg:right-6 lg:top-6 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* Thumbnail rail (desktop only) */}
          {images.length > 1 && (
            <div className="hidden md:flex flex-col gap-3 p-6 overflow-y-auto flex-shrink-0 w-24 lg:w-28">
              {images.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => api?.scrollTo(index)}
                  className={`aspect-[3/4] w-full overflow-hidden border transition-colors ${
                    current === index ? 'border-foreground' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={imageUrl}
                    alt={`${productName} thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Main viewer */}
          <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
            <Carousel
              className="w-full h-full"
              opts={{ align: 'start', loop: true, startIndex }}
              setApi={setApi}
            >
              <CarouselContent className="-ml-0 h-full">
                {images.map((imageUrl, index) => (
                  <CarouselItem key={index} className="pl-0 h-full flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt={`${productName} - View ${index + 1}`}
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="left-2 lg:left-4 bg-background/80 border-background/20 hover:bg-background" />
                  <CarouselNext className="right-2 lg:right-4 bg-background/80 border-background/20 hover:bg-background" />
                </>
              )}
            </Carousel>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ProductLightbox;
