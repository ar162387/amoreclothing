import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Plus, Minus, ChevronRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { formatPrice } from '@/data/store';
import { productsService, Product } from '@/services/products';
import { toast } from 'sonner';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useCartStore } from '@/store/cartStore';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const { addItem, openCart } = useCartStore();

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
        if (data?.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
      }
      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-6 py-20 text-center">
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-light mb-4">Product not found</h1>
          <Link to="/collections" className="text-sm underline">
            Return to Collections
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

  const handleAddToCart = () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }
    for (let i = 0; i < quantity; i++) {
      addItem(product, selectedSize);
    }
    toast.success(`${product.name} added to cart`);
    openCart();
  };

  return (
    <Layout>
      {/* Back Link */}
      <div className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <Link
            to="/collections"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Collections
          </Link>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Image Gallery */}
        <div className="order-1 lg:order-1">
          {/* Mobile: Carousel with swipe */}
          <div className="lg:hidden">
            {hasImages ? (
              <Carousel className="w-full" opts={{ align: 'start', loop: true }}>
                <CarouselContent className="-ml-0">
                  {images.map((imageUrl, index) => (
                    <CarouselItem key={index} className="pl-0">
                      <div className="w-full aspect-[3/4] bg-secondary">
                        <img
                          src={imageUrl}
                          alt={`${product.name} - View ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2 bg-background/80 border-background/20 hover:bg-background" />
                    <CarouselNext className="right-2 bg-background/80 border-background/20 hover:bg-background" />
                  </>
                )}
              </Carousel>
            ) : (
              <div className="w-full aspect-[3/4] bg-secondary flex items-center justify-center">
                <p className="text-muted-foreground">No images available</p>
              </div>
            )}
          </div>

          {/* Desktop: Scrollable Gallery */}
          <div className="hidden lg:block">
            <div className="space-y-0">
              {hasImages ? (
                images.map((imageUrl, index) => (
                  <div key={index} className="w-full aspect-[3/4] bg-secondary">
                    <img
                      src={imageUrl}
                      alt={`${product.name} - View ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              ) : (
                <div className="w-full aspect-[3/4] bg-secondary flex items-center justify-center">
                  <p className="text-muted-foreground">No images available</p>
                </div>
              )}
            </div>
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

            {/* Size Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">Size</span>
                  <Link to="/size-guide" className="text-xs underline text-muted-foreground">
                    Size Guide
                  </Link>
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
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 hover:bg-secondary transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
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
              <p>• Free shipping on orders over PKR 15,000</p>
              <p>• 14-day return policy</p>
              <p>• WhatsApp support: +92 300 1234567</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductDetail;