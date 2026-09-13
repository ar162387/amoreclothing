import { cloudinaryCrawlerThumbnail } from './cloudinary.js';
import { productPath } from './productUrl.js';
import { getProductCategory, getProductCompositions, getProductSearchDetails } from './catalogContent.js';
import type { Product } from "../services/products.js";
import type { ContactInfo } from "../services/siteContent.js";

/**
 * Pure data/logic only — no bundler-specific imports (no `@/assets/*.jpg`
 * image imports). That makes this module safe to reuse from the Vercel
 * serverless prerender function (api/prerender.ts), which is bundled by
 * esbuild rather than Vite and can't resolve Vite's asset-URL imports.
 */

export const SITE_URL = "https://rarstudio.co";
export const SITE_NAME = "RAR Studio";
export const SITE_TAGLINE = "Women's Western Co-ord Sets in Pakistan";
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION =
  "Shop women's western co-ord sets in Pakistan. Explore matching skirt and trouser sets with fabric and care details. Designed and made locally by RAR Studio.";
export const ENTITY_DESCRIPTION =
  "RAR Studio is a Rawalpindi women’s western co-ord label, not the Delhi designer or the Lisbon architecture practice.";
/** Hardcoded to match formatPrice() in src/data/store.ts — there's no per-product currency field. */
export const CURRENCY = "PKR";

/** Turns a route path ("/contact", "/product/abc") into an absolute site URL. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Square brand mark (the "RAR" wordmark only, no outer padding — same crop used for the favicon) —
 * this is what Google's Logo rich result / knowledge panel pulls in next to the site name in search
 * results. Google requires it be square-ish and under 5MB; this is ~512x512 and well under that. */
export const SITE_LOGO_URL = absoluteUrl("/favicon-512.png");

/** Loosely parses a free-text "City, Country" location string (e.g. "Rawalpindi, Pakistan.") into
 * a schema.org PostalAddress. Tolerant of a missing/odd format — worst case, everything lands in
 * addressLocality rather than producing no address at all. */
function buildPostalAddress(location: string | undefined) {
  if (!location) return undefined;
  const parts = location
    .split(",")
    .map((p) => p.trim().replace(/\.$/, ""))
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  const country = parts.length > 1 ? parts[parts.length - 1] : undefined;
  const locality = parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0];

  return {
    "@type": "PostalAddress",
    addressLocality: locality,
    ...(country ? { addressCountry: country } : {}),
  };
}

/**
 * "ClothingStore" (a schema.org LocalBusiness subtype) rather than the generic "Organization" —
 * more precise categorization for Google, and it's what carries a physical address. This is also
 * a real, concrete disambiguation signal against the two unrelated "RAR Studio"s that already
 * outrank this brand-new domain for the bare name: a Lisbon architecture practice and an Indian
 * apparel label — neither of which is a clothing store *in Pakistan* with this address.
 */
export function buildOrganizationJsonLd(info?: Partial<ContactInfo>) {
  const sameAs: string[] = [];
  if (info?.instagram_url) sameAs.push(info.instagram_url);
  const address = buildPostalAddress(info?.location);

  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    slogan: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      url: SITE_LOGO_URL,
      width: 512,
      height: 512,
    },
    image: SITE_LOGO_URL,
    priceRange: "PKR",
    areaServed: { "@type": "Country", name: "Pakistan" },
    knowsAbout: [
      "women's western co-ord sets",
      "skirt and top sets",
      "matching top and trouser sets",
      "silk and satin co-ord sets",
    ],
    ...(info?.email ? { email: info.email } : {}),
    ...(info?.phone ? { telephone: info.phone } : {}),
    ...(address ? { address } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/** Search titles identify the garment as well as the editorial product name. */
export function buildProductSearchTitle(product: Pick<Product, 'id' | 'name' | 'description' | 'available'> & Partial<Pick<Product, 'fabric_care' | 'size_guide'>>) {
  const displayName = product.name.toLocaleLowerCase().replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
  return `${displayName} — ${getProductSearchDetails(product).phrase} | ${SITE_NAME} Pakistan`;
}

export function buildProductMetaDescription(product: Pick<Product, "name" | "description"> & Partial<Pick<Product, "id" | "available" | "fabric_care" | "size_guide">>): string {
  const catalogProduct = { ...product, id: product.id ?? '', available: product.available ?? false };
  const detail = `${product.name}: ${getProductSearchDetails(catalogProduct).detail}.`;
  const suffix = " Made in Pakistan by RAR Studio.";
  const maxDetailLength = 154 - suffix.length;
  const clipped = detail.length > maxDetailLength
    ? detail.slice(0, maxDetailLength).replace(/\s+\S*$/, "")
    : detail;
  return `${clipped.trim().replace(/[.,:;\-–—]+$/, "")}.${suffix}`;
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
> & Partial<Pick<Product, "fabric_care" | "size_guide" | "sizes">> & { collections?: { name: string } | null };

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
    ...(getProductCompositions(product).length ? { material: getProductCompositions(product) } : {}),
    ...(product.sizes?.length ? { size: product.sizes } : {}),
    "@id": `${url}#product`,
    url,
    mainEntityOfPage: url,
    sku: product.id,
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(getProductCategory(product) ? { category: getProductCategory(product) } : product.collections?.name ? { category: product.collections.name } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: CURRENCY,
      price: Number(product.price).toFixed(2),
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
}

/** Describe the existing catalogue and its pictures, without presenting unrelated designs as variants.
 * Uses the same small CDN URLs as crawler HTML so there is one cached thumbnail per product. */
export function buildCatalogImageJsonLd(products: Array<Pick<Product, 'id' | 'name' | 'available'> & { image_front?: string | null }>) {
  const available = products.filter((product) => product.available);
  const items = available.map((product, index) => {
    const image = cloudinaryCrawlerThumbnail(product.image_front);
    return { '@type': 'ListItem', position: index + 1, url: absoluteUrl(productPath(product)), name: product.name,
      ...(image ? { image } : {}) };
  });
  const images = available.map((product) => cloudinaryCrawlerThumbnail(product.image_front)).filter((image): image is string => Boolean(image));
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE_URL}/#collection`,
    url: `${SITE_URL}/`, name: SITE_TITLE, description: SITE_DESCRIPTION,
    ...(images.length ? { image: images, primaryImageOfPage: images[0] } : {}),
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items },
  };
}
