import Layout from '@/components/layout/Layout';
import { useSitePage } from '@/contexts/SiteContentContext';
import { useSeo } from '@/hooks/use-seo';

/**
 * Standalone "Shipping, Exchange & Return" page. Content (hero copy + body) is fully
 * admin-editable via AdminSiteContent's Shipping tab — see src/config/siteContent.defaults.ts
 * for the fallback copy shown when no DB row exists yet.
 */
const ShippingReturns = () => {
  const shipping = useSitePage('shipping');

  useSeo({
    title: 'Shipping, Exchange & Return | RAR Studio',
    description: shipping.hero.body,
    canonicalPath: '/shipping-returns',
  });

  const paragraphs = shipping.body.split('\n\n').filter(Boolean);

  return (
    <Layout hasHero>
      <section className="relative h-[40vh] flex items-center bg-secondary">
        <div className="relative container mx-auto px-6 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-3">
            {shipping.hero.eyebrow}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-light mb-4">{shipping.hero.title}</h1>
          <p className="text-sm font-light text-muted-foreground max-w-lg mx-auto">{shipping.hero.body}</p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="space-y-6">
            {paragraphs.map((para, i) => {
              // A short, all-caps line (no lowercase letters) doubles as a section heading.
              const isHeading = para === para.toUpperCase() && para.length < 40;
              return isHeading ? (
                <h2 key={i} className="font-serif text-xl font-light mt-10 first:mt-0">
                  {para}
                </h2>
              ) : (
                <p key={i} className="text-sm font-light leading-relaxed text-muted-foreground">
                  {para}
                </p>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ShippingReturns;
