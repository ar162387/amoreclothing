import { Link } from 'react-router-dom';
import { Instagram, Mail, Phone } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-6 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <h2 className="font-serif text-2xl tracking-widest mb-6">amore</h2>
            <p className="text-sm font-light leading-relaxed opacity-70">
              Timeless elegance for the modern woman. Crafted with love, designed for you.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-medium tracking-widest uppercase mb-6">Shop</h3>
            <nav className="flex flex-col gap-3">
              <Link to="/collections" className="text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                Collections
              </Link>
              <Link to="/collections" className="text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                New Arrivals
              </Link>
              <Link to="/size-guide" className="text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                Size Guide
              </Link>
            </nav>
          </div>

          {/* Information */}
          <div>
            <h3 className="text-xs font-medium tracking-widest uppercase mb-6">Information</h3>
            <nav className="flex flex-col gap-3">
              <Link to="/about" className="text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                About Us
              </Link>
              <Link to="/contact" className="text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                Contact
              </Link>
              <Link to="/contact" className="text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                Shipping & Returns
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-medium tracking-widest uppercase mb-6">Contact</h3>
            <div className="flex flex-col gap-4">
              <a href="mailto:hello@amore.pk" className="flex items-center gap-3 text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                <Mail className="h-4 w-4" />
                hello@amore.pk
              </a>
              <a href="https://wa.me/923001234567" className="flex items-center gap-3 text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                <Phone className="h-4 w-4" />
                +92 300 1234567
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-light opacity-70 hover:opacity-100 transition-opacity">
                <Instagram className="h-4 w-4" />
                @amore.pk
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-background/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-light opacity-60">
              © 2025 Amore. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="#" className="text-xs font-light opacity-60 hover:opacity-100 transition-opacity">
                Privacy Policy
              </Link>
              <Link to="#" className="text-xs font-light opacity-60 hover:opacity-100 transition-opacity">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
