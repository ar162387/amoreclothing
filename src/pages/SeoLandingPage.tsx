import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useSitePage } from '@/contexts/SiteContentContext';
import { useSeo } from '@/hooks/use-seo';
import { absoluteUrl, SITE_LOGO_URL } from '@/lib/seo';
import { cloudinarySocialImage } from '@/lib/cloudinary';
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildLandingPageJsonLd,
  getLandingPage,
  selectLandingProducts,
} from '@/lib/landingPages';
import { productsService, type Product } from '@/services/products';

const SeoLandingPage = () => {
  const { pathname } = useLocation();
  const page = getLandingPage(pathname);
  const home = useSitePage('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(page?.kind === 'collection');

  useEffect(() => {
    let active = true;
    if (!page?.productSlugs) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    productsService.getProducts().then(({ data }) => {
      if (!active) return;
      setProducts(data ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [page]);

  const selectedProducts = useMemo(
    () => page ? selectLandingProducts(page, products) : [],
    [page, products],
  );
  const heroImage = home.hero.media.find((item) => item.type === 'image')?.url;
  const leadImage = selectedProducts[0]?.image_front || heroImage;
  const socialImage = leadImage ? absoluteUrl(cloudinarySocialImage(leadImage) || leadImage) : SITE_LOGO_URL;
  const jsonLd = page ? [
    buildLandingPageJsonLd(page, selectedProducts),
    buildBreadcrumbJsonLd(page),
    ...(page.faqs ? [buildFaqJsonLd(page.faqs)] : []),
  ] : [];

  useSeo({
    title: page?.title || 'Page not found | RAR Studio',
    description: page?.description || 'The requested RAR Studio page could not be found.',
    canonicalPath: page?.path || pathname,
    image: socialImage,
    imageAlt: page ? `${page.h1} — RAR Studio Pakistan` : 'RAR Studio Pakistan',
    jsonLd,
  });

  if (!page) return null;

  return (
    <Layout staticHeader>
      <section className="border-b border-border py-16 lg:py-24">
        <div className="container mx-auto max-w-5xl px-6">
          <nav aria-label="Breadcrumb" className="mb-10 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span>{page.h1}</span>
          </nav>
          <p className="mb-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">{page.eyebrow}</p>
          <h1 className="max-w-4xl font-serif text-4xl font-light leading-tight md:text-5xl lg:text-6xl">{page.h1}</h1>
        </div>
      </section>

      <section className="py-14 lg:py-20">
        <div className="container mx-auto max-w-5xl px-6">
          <div className="max-w-3xl space-y-6 text-sm font-light leading-7 text-muted-foreground md:text-base">
            {page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
      </section>

      {page.kind === 'collection' && (
        <section className="border-y border-border py-16 lg:py-24">
          <div className="container mx-auto max-w-6xl px-6">
            <h2 className="mb-10 font-serif text-3xl font-light">Shop the edit</h2>
            {loading ? (
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
                {page.productSlugs?.map((slug) => <ProductCardSkeleton key={slug} />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
                {selectedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {page.faqs && (
        <section className="py-16 lg:py-24">
          <div className="container mx-auto max-w-4xl px-6">
            <h2 className="mb-10 font-serif text-3xl font-light">Questions, answered</h2>
            <div className="divide-y divide-border border-y border-border">
              {page.faqs.map((faq) => (
                <article key={faq.question} className="py-7">
                  <h3 className="mb-3 font-serif text-xl font-light">{faq.question}</h3>
                  <p className="text-sm font-light leading-7 text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
};

export default SeoLandingPage;
