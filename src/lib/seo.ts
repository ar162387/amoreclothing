import type { Product } from "@/services/products";
import type { ContactInfo } from "@/services/siteContent";

/**
 * Pure data/logic only — no bundler-specific imports (no `@/assets/*.jpg`
 * image imports). That makes this module safe to reuse from the Vercel
 * serverless prerender function (api/prerender.ts), which is bundled by
 * esbuild rather than Vite and can't resolve Vite's asset-URL imports.
 */

export const SITE_URL = "https://rarstudio.co";
export const SITE_NAME = "RAR Studio";
/** Hardcoded to match formatPrice() in src/data/store.ts — there's no per-product currency field. */
export const CURRENCY = "PKR";

/** Turns a route path ("/contact", "/product/abc") into an absolute site URL. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildOrganizationJsonLd(info?: Partial<ContactInfo>) {
  const sameAs: string[] = [];
  if (info?.instagram_url) sameAs.push(info.instagram_url);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    ...(info?.email ? { email: info.email } : {}),
    ...(info?.phone ? { telephone: info.phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

export function buildContactPageJsonLd(info: ContactInfo) {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact | ${SITE_NAME}`,
    url: absoluteUrl("/contact"),
    about: buildOrganizationJsonLd(info),
  };
}

/** Product fields needed for JSON-LD — a subset of the full `Product` type so callers (including the
 * serverless prerender function, which queries Supabase directly rather than importing the client) don't
 * need every field populated. */
export type ProductJsonLdInput = Pick<
  Product,
  "id" | "name" | "price" | "description" | "image_front" | "image_back" | "images_other" | "available"
> & { collections?: { name: string } | null };

export function buildProductJsonLd(product: ProductJsonLdInput, url: string) {
  const images = [product.image_front, product.image_back, ...(product.images_other ?? [])].filter(
    (value): value is string => Boolean(value)
  );

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(images.length ? { image: images } : {}),
    sku: product.id,
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(product.collections?.name ? { category: product.collections.name } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: CURRENCY,
      price: Number(product.price).toFixed(2),
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
}
