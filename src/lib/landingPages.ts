import { absoluteUrl, SITE_NAME } from './seo.js';
import { productPath } from './productUrl.js';
import type { Product } from '../services/products.js';

export const HOME_EYEBROW = 'STILLNESS I';
export const HOME_H1 = "Women's western co-ord sets, made in Pakistan";

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingPageDefinition {
  path: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  paragraphs: string[];
  productSlugs?: string[];
  faqs?: LandingFaq[];
  kind: 'collection' | 'faq' | 'about';
}

export const SHOP_BY_TYPE_LINKS = [
  { path: '/collections/western-co-ord-sets', label: "Women's western co-ord sets" },
  { path: '/collections/skirt-and-top-sets', label: 'Skirt and top sets' },
  { path: '/collections/silk-satin-co-ords', label: 'Silk and satin co-ords' },
  { path: '/collections/stillness-i', label: 'STILLNESS I' },
] as const;

const WESTERN_FAQS: LandingFaq[] = [
  {
    question: 'What is a western co-ord?',
    answer: 'A western co-ord is a matching two-piece outfit shaped around contemporary shirts, tops, skirts or trousers. The pieces share a fabric story or colour direction, but each piece can also be styled separately.',
  },
  {
    question: 'Do you restock?',
    answer: 'No. RAR Studio works in limited drops and does not restock sold-out pieces, so each release stays considered and small.',
  },
  {
    question: 'Where are RAR Studio co-ords made?',
    answer: 'RAR Studio is based in Rawalpindi, Pakistan. Our women’s western co-ords are made in Pakistan and shipped nationwide.',
  },
];

export const SHIPPING_FAQS: LandingFaq[] = [
  { question: 'How long does order processing take?', answer: 'Orders are processed within 1–3 working days.' },
  { question: 'How long is delivery in Pakistan?', answer: 'Delivery within Pakistan normally takes 3–7 working days after processing.' },
  { question: 'When is shipping free?', answer: 'Shipping is free on orders over PKR 15,000.' },
  { question: 'What is the return and exchange window?', answer: 'Unworn items may be returned or exchanged within 14 days, subject to the full return conditions.' },
];

const FAQS: LandingFaq[] = [
  { question: 'What is a co-ord set?', answer: 'A co-ord set is a matching two-piece outfit designed to work as one look. At RAR Studio that can mean a shirt with a skirt, a top with a skirt, or a shirt with trousers.' },
  { question: 'What is the difference between a western co-ord and two-piece pret?', answer: 'Western co-ords use contemporary separates, silhouettes and styling rather than traditional ethnic pret construction. RAR Studio focuses on modern shirts, fitted or relaxed tops, skirts and trousers made to mix beyond the original set.' },
  { question: 'Do you restock?', answer: 'No. RAR Studio releases limited drops and does not restock sold-out designs.' },
  { question: 'Where is RAR Studio based?', answer: 'RAR Studio is based in Rawalpindi, Pakistan, and ships orders nationwide.' },
  { question: 'How long does delivery take in Pakistan?', answer: 'Processing takes 1–3 working days, followed by approximately 3–7 working days for delivery in Pakistan.' },
  { question: 'What is the difference between silk and satin?', answer: 'Silk is a fibre, while satin is a weave. A satin surface can be woven from silk or another fibre, so the product description should always be checked for the exact composition.' },
  { question: 'How do I choose a size?', answer: 'Open the size guide on the product page and compare its garment measurements with a similar piece you already own. Garment measurements are different from body measurements.' },
  { question: 'Can I wear the pieces separately?', answer: 'Yes. Every RAR Studio co-ord is designed as a complete look, but the top, shirt, skirt or trousers can be paired with pieces already in your wardrobe.' },
  { question: 'Are you the Delhi RAR Studio listed on Aza or Pernia?', answer: 'No. This is rarstudio.co, a Pakistan label for women’s western co-ords. We are not the Delhi ethnic-wear designer listed on Aza or Pernia.' },
];

export const LANDING_PAGES: LandingPageDefinition[] = [
  {
    path: '/collections/western-co-ord-sets',
    title: "Women's Western Co-ord Sets in Pakistan | RAR Studio",
    description: "Shop women's western co-ord sets made in Pakistan by RAR Studio, including matching skirt, shirt, top and trouser combinations from limited drops.",
    h1: 'Western co-ord sets for women in Pakistan',
    eyebrow: 'Shop by type',
    kind: 'collection',
    productSlugs: ['the-forest-accord', 'the-ivory-equation', 'the-meridian-pale', 'the-sage-hour', 'the-midnight-arc'],
    paragraphs: [
      'RAR Studio creates women’s western co-ord sets in Rawalpindi for wardrobes that need polish without noise. Each matching set begins as a complete silhouette: a considered shirt, top, skirt or trouser combination with proportion, movement and repeat wear in mind. The result is modern Pakistani womenswear that feels composed for work, dinners, travel and the spaces between occasions.',
      'Our debut drop, STILLNESS I, moves between softly structured trousers, long skirts, clean shirts and fitted tops. Fabrics range from textured cotton-viscose seersucker and crisp cotton blends to fluid silk and satin constructions. Product pages identify the actual fibre and weave, show garment measurements, care details, availability and multiple views, so you can compare the five designs without relying on vague fabric labels.',
      'Every set is designed and made in Pakistan in limited quantities. Wear the pieces together when you want an immediate outfit, then separate them with denim, a plain shirt, tailoring or an existing skirt. RAR Studio does not restock sold-out drops. We ship nationwide from Rawalpindi, and the clean product links below lead directly to the current sizes, price and stock status for each western co-ord.',
    ],
    faqs: WESTERN_FAQS,
  },
  {
    path: '/collections/skirt-and-top-sets',
    title: 'Skirt and Top Co-ord Sets in Pakistan | RAR Studio',
    description: 'Explore skirt and top co-ord sets in Pakistan from RAR Studio, with modern shirts, fitted tops, maxi skirts and clear garment measurements.',
    h1: 'Skirt and top co-ord sets',
    eyebrow: 'Shop by silhouette',
    kind: 'collection',
    productSlugs: ['the-sage-hour', 'the-meridian-pale', 'the-midnight-arc'],
    paragraphs: [
      'A skirt and top co-ord gives the ease of a dress with more ways to wear it. RAR Studio pairs long skirts with shirts or tops whose line, texture and colour are developed as part of the same outfit. The matching proportions create a finished look immediately, while the separate pieces make the set useful across more days, seasons and dress codes.',
      'The Sage Hour combines a softly puckered cotton-viscose seersucker shirt with a maxi skirt for smart-casual and semi-formal dressing. The Meridian Pale balances a pure-cotton shirt with a silk and mercerized-cotton skirt construction and silk lining. The Midnight Arc places a cotton-spandex jersey top against a woven cotton-spandex dobby skirt, creating contrast between a closer upper shape and a longer structured line.',
      'These are women’s western co-ords made in Pakistan, not generic two-piece pret. Check each product page for its current PKR price, available sizes, garment measurements, care notes and image gallery. Style the full set with minimal shoes and jewellery, or use the skirt with a quiet knit and the top with trousers already in your wardrobe. Each design belongs to a limited RAR Studio drop from Rawalpindi and will not be restocked after it sells out.',
    ],
  },
  {
    path: '/collections/silk-satin-co-ords',
    title: 'Silk and Satin Co-ord Sets in Pakistan | RAR Studio',
    description: 'Discover silk and satin co-ord sets in Pakistan with accurate fibre, weave, lining and care details from RAR Studio’s limited collection.',
    h1: 'Silk and satin co-ord sets',
    eyebrow: 'Shop by fabric story',
    kind: 'collection',
    productSlugs: ['the-ivory-equation', 'the-meridian-pale'],
    paragraphs: [
      'Silk and satin describe different things: satin is a weave; silk is a fibre. A satin surface can be made with silk or with another fibre, which is why RAR Studio states product composition and construction instead of treating the words as interchangeable. This collection page brings together the two STILLNESS I looks where lustre, drape and a refined surface are central to the design.',
      'The Ivory Equation is a formal and evening co-ord built around a silk-spandex blend in a satin weave, accompanied by a sheer pure-silk stole. The Meridian Pale combines a pure-cotton shirt with a skirt construction that includes silk and mercerized cotton, plus silk lining. The whole Meridian Pale outfit should not be described as pure silk or pure cotton; its interest comes from the deliberate conversation between those materials.',
      'Both sets are designed and made in Pakistan in limited quantities. Their product pages carry the current price in PKR, stock status, garment measurements, image views and fabric-care guidance. Wear the complete co-ord for a composed occasion look, or separate the pieces to soften their formality. RAR Studio is based in Rawalpindi and ships nationwide. Once a size or design sells out, it is not restocked, preserving the small-drop character of the collection.',
    ],
  },
  {
    path: '/collections/stillness-i',
    title: 'STILLNESS I — Debut Western Co-ord Collection | RAR Studio',
    description: 'Meet STILLNESS I, the debut RAR Studio collection of five limited women’s western co-ords designed and made in Pakistan.',
    h1: 'STILLNESS I',
    eyebrow: 'Debut collection',
    kind: 'collection',
    productSlugs: ['the-forest-accord', 'the-ivory-equation', 'the-meridian-pale', 'the-sage-hour', 'the-midnight-arc'],
    paragraphs: [
      'Made quiet for loud lives. STILLNESS I is the debut RAR Studio collection: five women’s western co-ords created in Rawalpindi and made in Pakistan. The drop explores calm through proportion rather than decoration, using long lines, restrained colour, touchable texture and pieces that hold their own after the matching look is taken apart.',
      'The Forest Accord introduces an easy trouser silhouette in a viscose-polyester crepe construction. The Ivory Equation moves into silk-spandex satin and a sheer silk stole. The Meridian Pale brings a cotton shirt into conversation with a silk and mercerized-cotton skirt. The Sage Hour uses cotton-viscose seersucker for a softly textured shirt and maxi skirt, while The Midnight Arc contrasts a jersey top with a woven dobby skirt.',
      'Together, the five sets establish RAR Studio as a Pakistan label for modern co-ordinated dressing rather than traditional ethnic pret. Each product page records its own composition, care, garment measurements, current price and availability. The pieces are intended to work as immediate outfits and as useful separates with an existing wardrobe. STILLNESS I is produced as a limited drop with no restocks. Orders are processed in Rawalpindi and shipped across Pakistan, allowing the collection to remain small while reaching women nationwide.',
    ],
  },
  {
    path: '/faq',
    title: 'Co-ord Sets FAQ — Sizing, Care, Shipping | RAR Studio',
    description: 'Answers about RAR Studio co-ord sizing, fabric care, limited restocks, shipping in Pakistan, silk versus satin and wearing pieces separately.',
    h1: 'Frequently asked questions',
    eyebrow: 'RAR Studio help',
    kind: 'faq',
    paragraphs: [
      'Use these answers to understand RAR Studio’s women’s western co-ords before choosing a set. We explain the difference between a coordinated outfit and traditional two-piece pret, how limited drops work, what garment measurements mean, how silk differs from satin, and how delivery works within Pakistan. Each product page remains the source of truth for that design’s exact composition, available sizes, care instructions, price and current stock.',
      'RAR Studio is based in Rawalpindi and designs modern skirt, shirt, top and trouser combinations that can be worn together or separated. STILLNESS I is our debut collection and is produced in limited quantities without restocks. If your question concerns a specific garment, compare the product description and size guide first, then contact us with the product name and the measurement you are checking. We ship nationwide and keep our public identity at rarstudio.co and @_rar.studio.',
    ],
    faqs: FAQS,
  },
  {
    path: '/about',
    title: 'About RAR Studio — Western Co-ords from Rawalpindi',
    description: 'Meet RAR Studio, a Rawalpindi label creating limited women’s western co-ord drops designed and made in Pakistan.',
    h1: 'About RAR Studio',
    eyebrow: 'Rawalpindi, Pakistan',
    kind: 'about',
    paragraphs: [
      'RAR Studio is a Rawalpindi label for women’s western co-ords, designed and made in Pakistan. We create matching shirts, tops, skirts and trousers with a quiet visual language: clear proportion, tactile fabric, restrained colour and enough versatility for the pieces to live beyond one complete look. Our work is contemporary western dressing from Pakistan, not traditional ethnic pret.',
      'STILLNESS I is our debut collection. Its five co-ords move through crepe, cotton, seersucker, silk, satin, jersey and dobby constructions, with the exact fibre and weave described on each product page. Made quiet for loud lives, the collection is intended for women who want an outfit to feel resolved without feeling overworked. Every set can be worn together, while each separate can return to an existing wardrobe.',
      'We release limited drops and do not restock sold-out designs. This keeps production considered and makes availability transparent: the product page shows the current sizes, price, care and stock status. Orders are processed in Rawalpindi and shipped across Pakistan. Our verified public profile is @_rar.studio on Instagram, and our official website is rarstudio.co.',
      'This RAR Studio is not the Lisbon architecture practice, not the Delhi ethnic RAR Studio listed by Aza or Pernia, and not therarstudio.com. Those are unrelated businesses. When you find rarstudio.co, you are visiting the Pakistan women’s western co-ord label behind STILLNESS I.',
    ],
  },
];

export const LANDING_PAGE_PATHS = LANDING_PAGES.map((page) => page.path);

export function getLandingPage(path: string): LandingPageDefinition | undefined {
  return LANDING_PAGES.find((page) => page.path === path);
}

export function buildBreadcrumbJsonLd(page: Pick<LandingPageDefinition, 'path' | 'h1'>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: page.h1, item: absoluteUrl(page.path) },
    ],
  };
}

export function buildFaqJsonLd(faqs: LandingFaq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function buildLandingPageJsonLd(page: LandingPageDefinition, products: Product[] = []) {
  const base = {
    '@context': 'https://schema.org',
    '@type': page.kind === 'collection' ? 'CollectionPage' : page.kind === 'about' ? 'AboutPage' : 'WebPage',
    '@id': `${absoluteUrl(page.path)}#page`,
    url: absoluteUrl(page.path),
    name: page.title,
    headline: page.h1,
    description: page.description,
    isPartOf: { '@id': `${absoluteUrl('/')}#website` },
    about: { '@id': `${absoluteUrl('/')}#organization` },
  } as Record<string, unknown>;

  if (page.kind === 'collection') {
    base.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.name,
        url: absoluteUrl(productPath(product)),
      })),
    };
  }
  return base;
}

export function selectLandingProducts(page: LandingPageDefinition, products: Product[]): Product[] {
  if (!page.productSlugs) return [];
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  return page.productSlugs.map((slug) => bySlug.get(slug)).filter((product): product is Product => Boolean(product));
}
