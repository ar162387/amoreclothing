import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { productsService, Product } from '@/services/products';
import { collectionsService, Collection } from '@/services/collections';
import collectionsHero from '@/assets/collections-hero.jpg';

const Collections = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [productsResult, collectionsResult] = await Promise.all([
        productsService.getProducts(),
        collectionsService.getCollections(),
      ]);

      if (productsResult.data) {
        setProducts(productsResult.data);
      }
      if (collectionsResult.data) {
        setCollections(collectionsResult.data);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // Filter products by collection
  const filteredProducts = selectedCollectionId
    ? products.filter((p) => p.collection_id === selectedCollectionId)
    : products;

  // Only show filters if there are 2+ collections
  const showFilters = collections.length >= 2;

  return (
    <Layout hasHero>
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={collectionsHero}
            alt="Amore Collections"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/30" />
        </div>
        <div className="relative container mx-auto px-6 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-background/80 mb-3">
            Shop
          </p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-background mb-4">
            The Essentials
          </h1>
          <p className="text-sm font-light text-background/80 max-w-lg mx-auto">
            Timeless pieces crafted for the modern woman. Our debut collection celebrates 
            understated luxury and effortless elegance.
          </p>
        </div>
      </section>

      {/* Filters - Only show if 2+ collections */}
      {showFilters && (
        <section className="py-8 border-b border-border sticky top-16 lg:top-20 bg-background z-40">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-center gap-8 overflow-x-auto">
              <button
                onClick={() => setSelectedCollectionId(null)}
                className={`text-sm tracking-wider whitespace-nowrap pb-2 border-b-2 transition-all ${
                  selectedCollectionId === null
                    ? 'border-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => setSelectedCollectionId(collection.id)}
                  className={`text-sm tracking-wider whitespace-nowrap pb-2 border-b-2 transition-all ${
                    selectedCollectionId === collection.id
                      ? 'border-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {collection.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Grid */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-6">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
              {[...Array(8)].map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-muted-foreground">No products found.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Collections;
