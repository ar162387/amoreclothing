import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Plus, Minus, ChevronRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { formatPrice } from '@/data/store';
import { productsService, Product } from '@/services/products';
import { toast } from 'sonner';
import ProductFullscreenViewer from '@/components/ProductFullscreenViewer';
import MobileAddToBagBar from '@/components/MobileAddToBagBar';
import SizeGuideDialog from '@/components/SizeGuideDialog';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { useCartStore, getCartTotals } from '@/store/cartStore';
import { useSeo } from '@/hooks/use-seo';
import { absoluteUrl, buildProductJsonLd, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/seo';
import { getOptimizedImageUrl, buildSrcSet } from '@/lib/productImage';
import { buildWhatsAppCheckoutUrl } from '@/lib/whatsappCheckout';
import { trackViewItem, trackAddToCart } from '@/lib/analytics';

const GALLERY_WIDTHS = [480, 640, 828, 1080, 1280, 1600];
const GALLERY_SIZES = '(min-width: 1024px) 50vw, 100vw';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mobileGalleryApi, setMobileGalleryApi] = useState<CarouselApi>();
  const [mobileGalleryIndex, setMobileGalleryIndex] = useState(0);
  // Advances every 2.5s; a manual swipe/drag resets the countdown instead of just pausing it
  // (stopOnInteraction: false — the plugin restarts its own timer after each interaction), and
  // the ref keeps this one plugin instance stable across re-renders instead of recreating it.
  const mobileGalleryAutoplay = useRef(Autoplay({ delay: 2500, stopOnInteraction: false }));
  const { items: cartItems, addItem, updateQuantity, openCart } = useCartStore();

  useEffect(() => {
    if (!mobileGalleryApi) return;
    const onSelect = () => setMobileGalleryIndex(mobileGalleryApi.selectedScrollSnap());
    onSelect();
    mobileGalleryApi.on('select', onSelect);
    return () => {
      mobileGalleryApi.off('select', onSelect);
    };
  }, [mobileGalleryApi]);

  // Called unconditionally (before the loading/not-found early returns below) per the rules of hooks —
  // falls back to generic brand copy until the product has loaded.
  useSeo({
    title: product ? `${product.name} | ${SITE_NAME}` : SITE_TITLE,
    description: product?.description || SITE_DESCRIPTION,
    canonicalPath: id ? `/product/${id}` : '/',
    image: product?.image_front ? absoluteUrl(product.image_front) : undefined,
    jsonLd: product && id ? buildProductJsonLd(product, absoluteUrl(`/product/${id}`)) : undefined,
  });

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await productsService.getProductById(id);
      if (error) {
        toast.error('Failed to load product');
        console.error(error);
      } else {
        setProduct(data);
        if (data) trackViewItem(data);
        // Default to whatever's already in the bag for this product (so re-opening the page
        // reflects the real cart state, not a blank picker), otherwise the first available size —
        // this must never leave the picker unselected, since that's what caused the confusion of
        // "Add to Bag" silently requiring a size nobody had visibly chosen.
        const existingCartItem = useCartStore.getState().items.find((item) => item.product.id === data?.id);
        setSelectedSize(existingCartItem?.size ?? data?.sizes?.[0] ?? '');
      }
      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  // The cart entry for whatever size is currently selected (if this product+size is already in the
  // bag) — the single source of truth the Quantity control below stays synced to, at the store level,
  // so the number shown here always matches what's actually in the cart (and vice versa).
  const cartEntry = product
    ? cartItems.find((item) => item.product.id === product.id && item.size === selectedSize)
    : undefined;

  useEffect(() => {
    setQuantity(cartEntry?.quantity ?? 1);
  }, [selectedSize, product?.id, cartEntry?.quantity]);

  if (loading) {
    return (
      <Layout staticHeader>
        <div className="container mx-auto px-6 py-20 text-center">
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout staticHeader>
        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-light mb-4">Product not found</h1>
          <Link to="/" className="text-sm underline">
            Return to Home
          </Link>
        </div>
      </Layout>
    );
  }

  // Build image array: front, back, and other images
  const images: string[] = [];
  if (product.image_front) images.push(product.image_front);
  if (product.image_back) images.push(product.image_back);
  if (product.images_other) images.push(...product.images_other);
  
  const hasImages = images.length > 0;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Takes an explicit size rather than reading `selectedSize` state, so callers that just resolved a
  // size synchronously (e.g. the mobile sticky bar's size picker) don't race a stale closure value.
  const addToCartWithSize = (size: string) => {
    if (product.sizes && product.sizes.length > 0 && !size) {
      toast.error('Please select a size');
      return;
    }
    setSelectedSize(size);

    // Already in the bag for this size — the Quantity control here is already the live cart quantity
    // (kept in sync by the effect above), so there's nothing new to add; just surface the cart.
    const existing = cartItems.find((item) => item.product.id === product.id && item.size === size);
    if (existing) {
      openCart();
      return;
    }

    for (let i = 0; i < quantity; i++) {
      addItem(product, size);
    }
    trackAddToCart(product, size, quantity);
    toast.success(`${product.name} added to cart`);
    openCart();
  };

  const handleAddToCart = () => addToCartWithSize(selectedSize);

  // Same behavior as CartDrawer's "Checkout via WhatsApp" — whatever's currently in the bag,
  // not just this product (see buildWhatsAppCheckoutUrl's doc comment).
  const handleWhatsAppCheckout = () => {
    const { totalPrice } = getCartTotals(cartItems);
    window.open(buildWhatsAppCheckoutUrl(cartItems, totalPrice), '_blank');
    toast.success('Redirecting to WhatsApp...');
  };

  // +/- updates the live cart quantity directly once this product+size is already in the bag, instead
  // of a separate "how many to add next" number — a single quantity, synced at the store level.
  const changeQuantity = (delta: number) => {
    const next = Math.max(1, quantity + delta);
    if (cartEntry) {
      updateQuantity(product.id, selectedSize, next);
    } else {
      setQuantity(next);
    }
  };

  return (
    <Layout staticHeader>
      {/* Mobile layout (<lg) — a single swipeable carousel (1 image visible at a time, swipe for the
          rest) followed by the buy-info block once. Tapping the visible image opens the same
          fullscreen lightbox as desktop. The sticky Add-to-Bag bar is the LAST child of this
          relative wrapper, which is what makes it stop sticking exactly when the product content
          ends, instead of floating over the footer below — see MobileAddToBagBar's doc comment. */}
      <div className="relative lg:hidden">
        <Link
          to="/"
          className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 text-sm hover:bg-background transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {hasImages ? (
          <Carousel
            opts={{ align: 'start', loop: true }}
            plugins={[mobileGalleryAutoplay.current]}
            setApi={setMobileGalleryApi}
            className="w-full"
          >
            <CarouselContent className="ml-0">
              {images.map((imageUrl, index) => (
                <CarouselItem key={index} className="pl-0">
                  <button
                    type="button"
                    onClick={() => openLightbox(index)}
                    className="w-full aspect-[3/4] bg-secondary block"
                  >
                    <img
                      src={getOptimizedImageUrl(imageUrl, 828)}
                      srcSet={buildSrcSet(imageUrl, GALLERY_WIDTHS)}
                      sizes={GALLERY_SIZES}
                      alt={`${product.name} - View ${index + 1}`}
                      // Set imperatively, not via a JSX `fetchPriority` prop — @types/react
                      // already declares it (matching a future React version) but React 18's
                      // runtime doesn't recognize the camelCase prop yet, so passing it in JSX
                      // just warns and never reaches the DOM (see SiteMedia.tsx for the same
                      // pattern). The browser only reads the lowercase `fetchpriority` attribute.
                      ref={(el) => el?.setAttribute('fetchpriority', index === 0 ? 'high' : 'auto')}
                      loading={index === 0 ? undefined : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </button>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-full transition-all ${
                      index === mobileGalleryIndex ? 'w-4 bg-background' : 'w-1.5 bg-background/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </Carousel>
        ) : (
          <div className="w-full aspect-[3/4] bg-secondary flex items-center justify-center">
            <p className="text-muted-foreground">No images available</p>
          </div>
        )}

        {/* Title — price lives solely in the sticky bar below, so it's never shown twice */}
        <div className="px-6 pt-6">
          <h1 className="font-serif text-3xl font-light">{product.name}</h1>
        </div>

        {/* Description — no label */}
        {product.description && (
          <div className="px-6 py-6">
            <p className="text-sm font-light leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </div>
        )}

        {/* Fabric / Care — admin-editable per product, shown right below the description */}
        {product.fabric_care && (
          <div className="px-6 pb-6">
            <h2 className="text-xs tracking-[0.15em] uppercase font-medium mb-2">Fabric / Care</h2>
            <p className="text-sm font-light leading-relaxed text-muted-foreground whitespace-pre-line">
              {product.fabric_care.body}
            </p>
          </div>
        )}

        {/* Size + Quantity — the ONLY place either is chosen; the sticky bar just reflects this
            same state rather than offering its own separate picker. */}
        <div className="p-6">
          {product.sizes && product.sizes.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium">Size</span>
                <SizeGuideDialog sizeGuide={product.size_guide || []} sizes={product.sizes || []} />
              </div>
              <div className="flex flex-wrap gap-3">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 border text-sm transition-all ${
                      selectedSize === size
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8">
            <span className="text-sm font-medium block mb-4">Quantity</span>
            <div className="flex items-center border border-border w-fit">
              <button
                onClick={() => changeQuantity(-1)}
                className="p-3 hover:bg-secondary transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-sm">{quantity}</span>
              <button
                onClick={() => changeQuantity(1)}
                className="p-3 hover:bg-secondary transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4 text-sm font-light text-muted-foreground">
            <p>• Free shipping via WhatsApp checkout · Rs 249 delivery on Cash on Delivery orders</p>
            <p>
              •{' '}
              <Link to="/shipping-returns" className="underline hover:text-foreground transition-colors">
                Shipping, Exchange & Return
              </Link>
            </p>
            <p>
              •{' '}
              <button
                type="button"
                onClick={handleWhatsAppCheckout}
                className="underline hover:text-foreground transition-colors"
              >
                Checkout via WhatsApp
              </button>
            </p>
          </div>
        </div>

        <MobileAddToBagBar
          productName={product.name}
          price={formatPrice(Number(product.price))}
          available={product.available}
          sizes={product.sizes ?? []}
          selectedSize={selectedSize}
          quantity={quantity}
          onSelectSize={setSelectedSize}
          onAdd={addToCartWithSize}
        />
      </div>

      {/* Desktop layout (lg+) — unchanged: two-column split, stacked gallery on the left, sticky
          buy-info sidebar on the right. */}
      <div className="hidden lg:grid lg:grid-cols-2">
        {/* Left: Image Gallery */}
        <div className="relative order-1 lg:order-1">
          {/* Back Link — floats over the top-left corner of the gallery */}
          <Link
            to="/"
            className="absolute left-4 top-4 lg:left-6 lg:top-6 z-10 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-2 text-sm hover:bg-background transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="space-y-0">
            {hasImages ? (
              images.map((imageUrl, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => openLightbox(index)}
                  className="w-full aspect-[3/4] bg-secondary block cursor-zoom-in"
                >
                  <img
                    src={getOptimizedImageUrl(imageUrl, 828)}
                    srcSet={buildSrcSet(imageUrl, GALLERY_WIDTHS)}
                    sizes={GALLERY_SIZES}
                    alt={`${product.name} - View ${index + 1}`}
                    // See the mobile gallery's <img> above for why this is imperative, not JSX.
                    ref={(el) => el?.setAttribute('fetchpriority', index === 0 ? 'high' : 'auto')}
                    loading={index === 0 ? undefined : 'lazy'}
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))
            ) : (
              <div className="w-full aspect-[3/4] bg-secondary flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Fixed Content Panel */}
        <div className="order-2 lg:order-2 lg:sticky lg:top-[5rem] lg:self-start lg:h-screen lg:overflow-y-auto">
          <div className="p-6 lg:p-12 lg:py-20">
            {/* Product Name */}
            <h1 className="font-serif text-3xl lg:text-4xl font-light mb-4">
              {product.name}
            </h1>

            {/* Price */}
            <p className="text-xl font-light mb-8">
              {formatPrice(Number(product.price))}
            </p>

            {/* Description */}
            {product.description && (
              <p className="text-sm font-light leading-relaxed text-muted-foreground mb-8">
                {product.description}
              </p>
            )}

            {/* Fabric / Care — admin-editable per product, shown right below the description */}
            {product.fabric_care && (
              <div className="mb-8">
                <h2 className="text-xs tracking-[0.15em] uppercase font-medium mb-2">Fabric / Care</h2>
                <p className="text-sm font-light leading-relaxed text-muted-foreground whitespace-pre-line">
                  {product.fabric_care.body}
                </p>
              </div>
            )}

            {/* Size Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium">Size</span>
                  <SizeGuideDialog sizeGuide={product.size_guide || []} sizes={product.sizes || []} />
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 border text-sm transition-all ${
                        selectedSize === size
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border hover:border-foreground'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-8">
              <span className="text-sm font-medium block mb-4">Quantity</span>
              <div className="flex items-center border border-border w-fit">
                <button
                  onClick={() => changeQuantity(-1)}
                  className="p-3 hover:bg-secondary transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm">{quantity}</span>
                <button
                  onClick={() => changeQuantity(1)}
                  className="p-3 hover:bg-secondary transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={!product.available}
              className="w-full py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mb-8"
            >
              {product.available ? 'Add to Bag' : 'Sold Out'}
            </button>

            {/* Additional Info */}
            <div className="space-y-4 text-sm font-light text-muted-foreground">
              <p>• Free shipping via WhatsApp checkout · Rs 249 delivery on Cash on Delivery orders</p>
              <p>
                •{' '}
                <Link to="/shipping-returns" className="underline hover:text-foreground transition-colors">
                  Shipping, Exchange & Return
                </Link>
              </p>
              <p>
              •{' '}
              <button
                type="button"
                onClick={handleWhatsAppCheckout}
                className="underline hover:text-foreground transition-colors"
              >
                Checkout via WhatsApp
              </button>
            </p>
            </div>
          </div>
        </div>
      </div>

      <ProductFullscreenViewer
        images={images}
        open={lightboxOpen}
        startIndex={lightboxIndex}
        onOpenChange={setLightboxOpen}
        productName={product.name}
      />
    </Layout>
  );
};

export default ProductDetail;