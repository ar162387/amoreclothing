import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { productsService, Product } from '@/services/products';
import heroImage from '@/assets/hero-main.jpg';
import collectionEvening from '@/assets/collection-evening.jpg';
import collectionSummer from '@/assets/collection-summer.jpg';

const Index = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data } = await productsService.getProducts();
      if (data) {
        const featured = data.filter((p) => p.featured).slice(0, 4);
        setFeaturedProducts(featured);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  return (
    <Layout hasHero>
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Amore Collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/30" />
        </div>
        <div className="relative container mx-auto px-6">
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.3em] uppercase mb-4 text-background/80">
              New Collection
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light leading-tight mb-6 text-background">
              Timeless Elegance
            </h1>
            <p className="text-base font-light leading-relaxed mb-8 text-background/80 max-w-md">
              Discover our debut collection of refined essentials, crafted for the modern woman.
            </p>
            <Link
              to="/collections"
              className="inline-flex items-center gap-3 text-sm tracking-widest uppercase border-b border-background text-background pb-2 hover:opacity-70 transition-opacity"
            >
              Explore Collection
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-end mb-12">
            <div>
              <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
                Curated Selection
              </p>
              <h2 className="font-serif text-3xl lg:text-4xl font-light">
                Featured Pieces
              </h2>
            </div>
            <Link
              to="/collections"
              className="hidden md:flex items-center gap-2 text-sm tracking-wide hover:opacity-70 transition-opacity"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[...Array(4)].map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <Link
            to="/collections"
            className="md:hidden flex items-center justify-center gap-2 text-sm tracking-wide mt-10 hover:opacity-70 transition-opacity"
          >
            View All Products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Category Tiles */}
      <section className="py-20 lg:py-28 bg-secondary">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
              Explore
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-light">
              Shop by Style
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/collections" className="group relative overflow-hidden aspect-[4/5]">
              <img
                src={collectionSummer}
                alt="Day Collection"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
              <div className="absolute bottom-8 left-8">
                <p className="text-xs tracking-[0.2em] uppercase text-background/70 mb-2">
                  Effortless Style
                </p>
                <h3 className="font-serif text-2xl text-background">Day to Evening</h3>
              </div>
            </Link>

            <Link to="/collections" className="group relative overflow-hidden aspect-[4/5]">
              <img
                src={collectionEvening}
                alt="Evening Collection"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
              <div className="absolute bottom-8 left-8">
                <p className="text-xs tracking-[0.2em] uppercase text-background/70 mb-2">
                  Sophisticated Elegance
                </p>
                <h3 className="font-serif text-2xl text-background">Evening Wear</h3>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Brand Story Teaser */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
              Our Philosophy
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-light leading-relaxed mb-6">
              "True elegance is about feeling beautiful in your own skin. We create pieces that enhance, not overshadow."
            </h2>
            <Link
              to="/about"
              className="inline-flex items-center gap-3 text-sm tracking-widest uppercase border-b border-foreground pb-2 hover:opacity-70 transition-opacity"
            >
              Our Story
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
