import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag, Search } from 'lucide-react';
import { useCartTotalItems, useCartStore } from '@/store/cartStore';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { productsService, Product } from '@/services/products';
import { formatPrice } from '@/data/store';

interface HeaderProps {
  hasHero?: boolean;
  /** Render in-flow (static) instead of fixed-overlay — see Layout.tsx. */
  staticHeader?: boolean;
}

const Header = ({ hasHero = false, staticHeader = false }: HeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const totalItems = useCartTotalItems();
  const { openCart } = useCartStore();
  const location = useLocation();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch the product list once, the first time the search panel opens
  useEffect(() => {
    if (!isSearchOpen || productsLoaded) return;
    const fetchProducts = async () => {
      const { data } = await productsService.getProducts();
      if (data) setAllProducts(data);
      setProductsLoaded(true);
    };
    fetchProducts();
  }, [isSearchOpen, productsLoaded]);

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
  };

  // Close on route change
  useEffect(() => {
    closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  const searchResults = query.trim()
    ? allProducts
        .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  useEffect(() => {
    const handleScroll = () => {
      // Trigger when scrolled past half of hero (60vh / 2 = 30vh)
      const heroHalf = window.innerHeight * 0.3;
      setIsScrolled(window.scrollY > heroHalf);
    };

    if (hasHero) {
      window.addEventListener('scroll', handleScroll);
      handleScroll(); // Check initial position
      return () => window.removeEventListener('scroll', handleScroll);
    } else {
      setIsScrolled(true);
    }
  }, [hasHero]);

  const navLinks = [
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const isTransparent = hasHero && !isScrolled && !isSearchOpen;

  return (
    <header
      className={`${staticHeader ? 'static' : 'fixed top-0 left-0 right-0'} z-50 transition-all duration-300 ${
        isTransparent 
          ? 'bg-transparent border-b border-transparent' 
          : 'bg-background/95 backdrop-blur-sm border-b border-border'
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger className={`lg:hidden p-2 -ml-2 ${isTransparent ? 'text-background' : ''}`}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-background">
              <nav className="flex flex-col gap-8 mt-12">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="text-lg font-light tracking-wide hover:opacity-60 transition-opacity"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <img
              src="/logo.png"
              alt="RAR Studio"
              className={`h-11 w-auto lg:h-16 object-contain transition-[filter] ${isTransparent ? 'brightness-0 invert' : ''}`}
            />
          </Link>

          {/* Right Navigation */}
          <div className="flex items-center gap-6 ml-auto">
            <nav className="hidden lg:flex items-center gap-10">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-light tracking-wider uppercase transition-opacity hover:opacity-60 ${
                    isTransparent ? 'text-background' : ''
                  } ${isActive(link.href) ? 'opacity-100' : 'opacity-80'}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <button
              onClick={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
              className={`p-2 hover:opacity-60 transition-opacity ${isTransparent ? 'text-background' : ''}`}
            >
              <Search className="h-4 w-4" />
            </button>

            <button 
              onClick={openCart}
              className={`p-2 relative hover:opacity-60 transition-opacity ${isTransparent ? 'text-background' : ''}`}
            >
              <ShoppingBag className="h-4 w-4" />
              {totalItems > 0 && (
                <span className={`absolute -top-1 -right-1 text-xs w-5 h-5 flex items-center justify-center rounded-full ${
                  isTransparent ? 'bg-background text-foreground' : 'bg-foreground text-background'
                }`}>
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {isSearchOpen && (
          <div ref={searchContainerRef} className="py-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-transparent border-b border-border py-2 pr-8 text-sm focus:outline-none focus:border-foreground transition-colors"
                autoFocus
              />
              <button
                onClick={closeSearch}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {query.trim() && (
              <div className="mt-2 max-h-96 overflow-y-auto bg-background border border-border shadow-lg">
                {searchResults.length > 0 ? (
                  searchResults.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.id}`}
                      onClick={closeSearch}
                      className="flex items-center gap-4 p-3 hover:bg-secondary transition-colors"
                    >
                      <div className="w-12 h-16 bg-secondary flex-shrink-0 overflow-hidden">
                        {product.image_front && (
                          <img
                            src={product.image_front}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-light truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(Number(product.price))}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="p-4 text-sm text-muted-foreground text-center">No products found</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
