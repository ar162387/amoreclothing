import type { Product } from '../services/products.js';

export type CatalogProduct = Pick<Product, 'id' | 'name' | 'description' | 'available'> &
  Partial<Pick<Product, 'fabric_care' | 'size_guide' | 'sizes'>>;

export const COLLECTION_TITLE = "Women's western co-ord sets in Pakistan";
export const COLLECTION_INTRO = "Shop women's western co-ord sets in Pakistan, designed and made locally. Discover skirt-and-top sets and matching tops and trousers, with fabric, care and garment measurements on each product page.";
export const STYLING_TITLE = 'From day to evening';
export const STYLING_BODY = 'Style matching tops and trousers with flats for a casual daytime look, then add heels and jewellery for the evening. Wear a skirt-and-top set together for a considered outfit, or style the pieces separately with favourites already in your wardrobe.';

/** Read composition declarations, not care instructions (which can mention other fabrics).
 * Preserve the merchant's blend wording; a satin weave does not imply pure silk. */
export function getProductCompositions(product: CatalogProduct): string[] {
  return [...new Set((product.fabric_care?.body ?? '').split('\n')
    .map((line) => line.match(/^\s*compos(?:ition|tion)\s*:\s*(.+)/i)?.[1]?.trim())
    .filter((value): value is string => Boolean(value)))];
}

export function getProductCategory(product: CatalogProduct): string | undefined {
  const garments = (product.size_guide ?? []).map((head) => head.label).join(' ');
  const text = garments || product.description || '';
  if (/\bskirt\b/i.test(text)) return 'Skirt and top set';
  if (/\b(trousers?|pants)\b/i.test(text)) return 'Matching top and trousers set';
  return undefined;
}

export function getProductSummary(product: CatalogProduct): string {
  const category = getProductCategory(product);
  const composition = getProductCompositions(product);
  return [category, composition.length ? `Composition: ${composition.join('; ')}` : ''].filter(Boolean).join('. ');
}

export function getProductHighlights(product: CatalogProduct): string {
  return [getMaterialLabel(product), getProductSummary(product), 'Made in Pakistan']
    .filter(Boolean).join('. ') + '.';
}

export function getMaterialLabel(product: CatalogProduct): string | undefined {
  const compositions = getProductCompositions(product);
  const construction = (product.fabric_care?.body ?? '').split('\n')
    .filter((line) => /^\s*construction\s*:/i.test(line)).join(' ');
  if (compositions.some((value) => /\bsilk\b/i.test(value)) && /\bsatin\b/i.test(construction)) {
    return 'Silk co-ord set in a satin weave';
  }
  if (/\bsatin\b/i.test(construction)) return 'Satin co-ord set';
  return undefined;
}

export function buildShoppingSections(products: CatalogProduct[]) {
  const available = products.filter((product) => product.available);
  return [
    { id: 'skirt-and-top-sets', title: 'Skirt and top co-ord sets',
      body: 'Explore matching shirts and tops with skirts. Compare the fabric composition and garment measurements to find your fit.',
      products: available.filter((product) => getProductCategory(product) === 'Skirt and top set') },
    { id: 'top-and-trouser-sets', title: 'Top and trouser co-ord sets',
      body: 'Discover matching tops and trousers for a complete co-ord look. Check each set for its silhouette, fabric blend and care instructions.',
      products: available.filter((product) => getProductCategory(product) === 'Matching top and trousers set') },
    { id: 'silk-and-satin-sets', title: 'Silk and satin co-ord sets',
      body: 'Satin describes a weave; silk describes a fibre. Explore the listed blends below, and read each product’s fabric and care details before choosing.',
      products: available.filter((product) => Boolean(getMaterialLabel(product))) },
  ].filter((section) => section.products.length > 0);
}

/** Specific search copy is derived from each assigned fabric record, never its product name.
 * Unrecognised records keep the generic garment wording instead of inheriting another item's claims. */
export function getProductSearchDetails(product: CatalogProduct): { phrase: string; detail: string } {
  const title = product.fabric_care?.title.toLowerCase() ?? '';
  const fabric = (product.fabric_care?.body ?? '').split(/^\s*care\s*:?\s*$/im)[0].toLowerCase();
  const category = getProductCategory(product);
  if (category === 'Matching top and trousers set' && /\bsilk\b/.test(title) && /silk-spandex/.test(fabric) && /satin/.test(fabric)) {
    return { phrase: 'Silk Co-ord Set', detail: 'Silk-spandex satin co-ord set for formal and evening wear' };
  }
  if (category === 'Matching top and trousers set' && /crepe/.test(title) && /viscose.*polyester/.test(fabric)) {
    return { phrase: 'Crepe Co-ord Set', detail: 'Viscose-polyester crepe top and trouser set for western casual wear' };
  }
  if (category === 'Skirt and top set' && /seersucker/.test(title) && /cotton.*viscose/.test(fabric)) {
    return { phrase: 'Seersucker Skirt & Top Set', detail: 'Cotton-viscose seersucker shirt and maxi skirt set for smart casual to semi-formal wear' };
  }
  if (category === 'Skirt and top set' && /cotton/.test(title) && /silk/.test(title) && /silk\/mercerized cotton/.test(fabric)) {
    return { phrase: 'Cotton & Silk Skirt Set', detail: 'Cotton shirt and silk-cotton maxi skirt set with silk lining' };
  }
  if (category === 'Skirt and top set' && /cotton spandex/.test(title) && /jersey/.test(fabric) && /dobby/.test(fabric)) {
    return { phrase: 'Cotton Skirt & Top Set', detail: 'Cotton-spandex knit top and woven dobby skirt set for western casual wear' };
  }
  return { phrase: category ?? 'Co-ord Set', detail: getProductSummary(product) || product.description?.split(/(?<=[.!?])\s/)[0] || product.name };
}

export function getProductImageAlt(product: CatalogProduct, view = 'front view'): string {
  return `${product.name} — ${getProductSearchDetails(product).phrase.toLowerCase()}, ${view}`;
}
