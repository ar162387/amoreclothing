import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag, Search } from 'lucide-react';
import { useCartTotalItems, useCartStore } from '@/store/cartStore';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface HeaderProps {
  hasHero?: boolean;
}

const Header = ({ hasHero = false }: HeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const totalItems = useCartTotalItems();
  const { openCart } = useCartStore();
  const location = useLocation();

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
    { href: '/collections', label: 'Collections' },
    { href: '/about', label: 'About' },
    { href: '/size-guide', label: 'Size Guide' },
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isProductDetailPage = location.pathname.startsWith('/product/');
  
  const isTransparent = hasHero && !isScrolled && !isSearchOpen;

  return (
    <header 
      className={`${isProductDetailPage ? 'static' : 'fixed top-0 left-0 right-0'} z-50 transition-all duration-300 ${
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

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-10">
            {navLinks.slice(0, 2).map((link) => (
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

          {/* Logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <h1 className={`font-serif text-2xl lg:text-3xl tracking-widest ${isTransparent ? 'text-background' : ''}`}>
              amore
            </h1>
          </Link>

          {/* Right Navigation */}
          <div className="flex items-center gap-6">
            <nav className="hidden lg:flex items-center gap-10">
              {navLinks.slice(2).map((link) => (
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
              onClick={() => setIsSearchOpen(!isSearchOpen)}
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
          <div className="py-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full bg-transparent border-b border-border py-2 text-sm focus:outline-none focus:border-foreground transition-colors"
                autoFocus
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
