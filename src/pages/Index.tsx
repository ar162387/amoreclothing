import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import SiteMediaRotator from '@/components/SiteMediaRotator';
import { productsService, Product } from '@/services/products';
import { useSitePage } from '@/contexts/SiteContentContext';
import { useSeo } from '@/hooks/use-seo';
import { absoluteUrl, buildOrganizationJsonLd, buildWebsiteJsonLd } from '@/lib/seo';

const Index = () => {
  const home = useSitePage('home');
  const contact = useSitePage('contact');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const heroImage = home.hero.media.find((item) => item.type === 'image');
  useSeo({
    title: 'RAR Studio | Timeless Luxury Fashion',
    description: home.hero.body,
    canonicalPath: '/',
    image: heroImage ? absoluteUrl(heroImage.url) : undefined,
    jsonLd: [buildOrganizationJsonLd(contact.info), buildWebsiteJsonLd()],
  });

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data } = await productsService.getProducts();
      if (data) {
        setProducts(data);
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
          <SiteMediaRotator
            items={home.hero.media}
            intervalSeconds={home.media_rotation_seconds}
            className="w-full h-full object-cover"
            priority
          />
          <div className="absolute inset-0 bg-foreground/30" />
        </div>
        <div className="relative container mx-auto px-6">
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.3em] uppercase mb-4 text-background/80">
              {home.hero.eyebrow}
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light leading-tight mb-6 text-background">
              {home.hero.title}
            </h1>
            <p className="text-base font-light leading-relaxed mb-8 text-background/80 max-w-md">
              {home.hero.body}
            </p>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-6">
          <div className="mb-12">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
              {home.products.eyebrow}
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-light">
              {home.products.title}
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[...Array(8)].map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Category Tiles */}
      <section className="py-20 lg:py-28 bg-secondary">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2">
              {home.style.eyebrow}
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-light">
              {home.style.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {home.style.tiles.map((tile, index) => (
              <Link key={index} to={tile.href} className="group relative overflow-hidden aspect-[4/5]">
                <SiteMediaRotator
                  items={tile.media}
                  intervalSeconds={home.media_rotation_seconds}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                <div className="absolute bottom-8 left-8">
                  <p className="text-xs tracking-[0.2em] uppercase text-background/70 mb-2">
                    {tile.eyebrow}
                  </p>
                  <h3 className="font-serif text-2xl text-background">{tile.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Story Teaser */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
              {home.philosophy.eyebrow}
            </p>
            <h2 className="font-serif text-3xl lg:text-4xl font-light leading-relaxed mb-6">
              {home.philosophy.quote}
            </h2>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
