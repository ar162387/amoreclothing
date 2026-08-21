import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import { useSitePage } from '@/contexts/SiteContentContext';
import { useSeo } from '@/hooks/use-seo';

/**
 * Standalone "Shipping, Exchange & Return" page. Content (title + body) is fully admin-editable
 * via AdminSiteContent's Shipping tab — see src/config/siteContent.defaults.ts for the fallback
 * copy shown when no DB row exists yet.
 *
 * Deliberately skips Layout/Header — there's no hero image here, so the full nav bar (search,
 * cart, Contact link) would just be dead weight. Instead a minimal bar: a Back button and the
 * plain black logo on white, matching a simple reference/help page rather than a shopping page.
 */
const ShippingReturns = () => {
  const navigate = useNavigate();
  const shipping = useSitePage('shipping');

  useSeo({
    title: 'Shipping, Exchange & Return | RAR Studio',
    description: shipping.hero.body,
    canonicalPath: '/shipping-returns',
  });

  const paragraphs = shipping.body.split('\n\n').filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 h-16 lg:h-20 flex items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm hover:opacity-60 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <img src="/logo.png" alt="RAR Studio" width={1002} height={547} className="h-11 lg:h-14 w-auto object-contain" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-6 max-w-3xl">
            <h1 className="font-serif text-3xl md:text-4xl font-light mb-3">{shipping.hero.title}</h1>
            <p className="text-sm font-light text-muted-foreground mb-12">{shipping.hero.body}</p>

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
      </main>

      <Footer />
    </div>
  );
};

export default ShippingReturns;
