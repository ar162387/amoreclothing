import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatPrice } from '@/data/store';
import { Product } from '@/services/products';
import { useCartStore } from '@/store/cartStore';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { addItem, openCart } = useCartStore();
  
  const frontImage = product.image_front || '';
  const backImage = product.image_back || '';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!product.available || !product.sizes || product.sizes.length === 0) {
      return;
    }
    
    // Add with first available size
    addItem(product, product.sizes[0]);
    openCart();
  };

  return (
    <div className="group">
      <Link 
        to={`/product/${product.id}`} 
        className="block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative overflow-hidden bg-secondary aspect-[3/4] mb-4">
          {frontImage && (
            <img
              src={frontImage}
              alt={product.name}
              className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${
                isHovered && backImage ? 'opacity-0' : 'opacity-100'
              }`}
            />
          )}
          {backImage && (
            <img
              src={backImage}
              alt={`${product.name} - back view`}
              className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-500 ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
          {!product.available && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <span className="text-xs tracking-widest uppercase">Sold Out</span>
            </div>
          )}
          {product.available && product.sizes && product.sizes.length > 0 && (
            <button
              onClick={handleAddToCart}
              className="absolute bottom-3 right-3 w-8 h-8 bg-background/90 hover:bg-background text-foreground rounded-full flex items-center justify-center border-2 border-foreground z-20"
              aria-label="Add to cart"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-light tracking-wide">{product.name}</h3>
          <p className="text-sm font-light text-muted-foreground">{formatPrice(Number(product.price))}</p>
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;
