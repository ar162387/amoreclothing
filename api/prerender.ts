import fs from 'node:fs';
import path from 'node:path';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ENTITY_DESCRIPTION, SITE_DESCRIPTION, SITE_LOGO_URL, SITE_NAME, SITE_TITLE, absoluteUrl,
  buildCatalogImageJsonLd, buildContactPageJsonLd, buildOrganizationJsonLd, buildProductJsonLd,
  buildProductMetaDescription, buildProductSearchTitle, buildWebsiteJsonLd,
} from '../src/lib/seo.js';
import {
  COLLECTION_INTRO, COLLECTION_TITLE, STYLING_BODY, STYLING_TITLE, buildShoppingSections,
  getProductHighlights, getProductImageAlt, getProductSummary, type CatalogProduct,
} from '../src/lib/catalogContent.js';
import { cloudinaryCrawlerThumbnail, cloudinaryImageUrl, cloudinarySocialImage } from '../src/lib/cloudinary.js';
import { productIdFromRoute, productPath } from '../src/lib/productUrl.js';
import type { Product, SizeGuide } from '../src/services/products.js';
import type { ContactInfo, SiteMediaValue } from '../src/services/siteContent.js';

const HOME_FALLBACK = {
  title: 'Timeless Elegance',
  body: 'Discover our debut collection of refined essentials, crafted for the modern woman.',
  tiles: [
    { eyebrow: 'Effortless Style', title: 'Day to Evening' },
    { eyebrow: 'Sophisticated Elegance', title: 'Evening Wear' },
  ],
};

const CONTACT_FALLBACK: ContactInfo = {
  email: 'portfoliowaqar@gmail.com',
  phone: '+92 300 1056929',
  instagram_handle: '@_rar.studio',
  instagram_url: 'https://www.instagram.com/_rar.studio?igsh=anVxZHNjeDNwbjhr',
  location: 'Rawalpindi, Pakistan',
  whatsapp_message: 'Hello! I have a question about RAR Studio.',
};

const CONTACT_HERO_FALLBACK = "We'd love to hear from you. Send us a message and we'll respond as soon as possible.";
const SHIPPING_FALLBACK = {
  title: 'Shipping, Exchange & Return',
  body: 'Everything you need to know about delivery, exchanges, and returns.',
};

type ServerProduct = Product & { collections?: { name: string } | null };
type SiteContentRow = { page: string; content: Record<string, unknown> | null };
let cachedSpaShell: string | undefined;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadSpaShell(): string {
  if (cachedSpaShell) return cachedSpaShell;
  const candidates = [path.join(process.cwd(), 'dist', 'index.html'), path.join(process.cwd(), 'index.html')];
  const shellPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!shellPath) throw new Error('Vite HTML shell was not packaged with the prerender function');
  cachedSpaShell = fs.readFileSync(shellPath, 'utf8');
  return cachedSpaShell;
}

function stripDefaultSeo(html: string): string {
  const metaKeys = [
    'description', 'robots', 'og:title', 'og:description', 'og:type', 'og:site_name', 'og:url', 'og:image',
    'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:title',
    'twitter:description', 'twitter:image', 'twitter:image:alt',
  ];
  let result = html.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  for (const key of metaKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`<meta\\b[^>]*(?:name|property)=["']${escaped}["'][^>]*>\\s*`, 'gi'), '');
  }
  return result.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*data-rar-seo[^>]*>[\s\S]*?<\/script>\s*/gi, '');
}

interface PageOptions {
  title: string;
  description: string;
  canonicalPath: string;
  image?: string;
  imageAlt?: string;
  ogType?: 'website' | 'product';
  robots?: string;
  jsonLd: object[];
  bodyHtml: string;
}

function renderPage({ title, description, canonicalPath, image, imageAlt, ogType = 'website',
  robots = 'index,follow,max-image-preview:large', jsonLd, bodyHtml }: PageOptions): string {
  const canonical = absoluteUrl(canonicalPath);
  const jsonLdScripts = jsonLd.map((data) =>
    `<script type="application/ld+json" data-rar-seo="server">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
  ).join('\n');
  const imageTags = image ? `<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
${imageAlt ? `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />` : ''}
<meta name="twitter:image" content="${escapeHtml(image)}" />
${imageAlt ? `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />` : ''}` : '';
  const head = `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="${escapeHtml(robots)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:url" content="${canonical}" />
${imageTags}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
${jsonLdScripts}`;
  const shell = stripDefaultSeo(loadSpaShell()).replace('</head>', `${head}\n</head>`);
  if (!/<div id=["']root["']>\s*<\/div>/.test(shell)) throw new Error('Vite HTML shell is missing an empty #root');
  return shell.replace(/<div id=["']root["']>\s*<\/div>/,
    `<div id="root"><div data-rar-prerendered>${bodyHtml}</div></div>`);
}

function renderSizeGuide(heads: SizeGuide, sizes: string[]): string {
  if (!sizes.length) return '';
  const tables = heads.filter((head) => head.label && head.rows.length).map((head) => `
<h3>${escapeHtml(head.label)}</h3><table><thead><tr><th scope="col">Measurement</th>
${sizes.map((size) => `<th scope="col">${escapeHtml(size)}</th>`).join('')}</tr></thead><tbody>
${head.rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th>${sizes.map((size) => `<td>${escapeHtml(row.values[size] || '—')}</td>`).join('')}</tr>`).join('')}
</tbody></table>`).join('');
  return tables ? `<h2>Size Guide</h2><p>Measurements are garment measurements, not body measurements.</p>${tables}` : '';
}

function sendHtml(res: VercelResponse, status: number, html: string) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
}

function sendUnavailable(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Retry-After', '60');
  sendHtml(res, 503, '<!doctype html><html lang="en"><head><meta name="robots" content="noindex"><title>Please try again shortly</title></head><body><h1>Please try again shortly</h1></body></html>');
}

function redirectWithOriginalQuery(req: VercelRequest, res: VercelResponse, destination: string) {
  const requestUrl = new URL(req.url || '/', 'https://rarstudio.co');
  requestUrl.searchParams.delete('path');
  requestUrl.searchParams.delete('id');
  const query = requestUrl.searchParams.toString();
  res.status(301).setHeader('Location', `${destination}${query ? `?${query}` : ''}`).end();
}

function firstImage(media: unknown): string | undefined {
  if (!Array.isArray(media)) return undefined;
  return (media as SiteMediaValue[]).find((item) => item?.type === 'image' && item.url)?.url;
}

async function loadSiteContent(supabase: SupabaseClient): Promise<SiteContentRow[]> {
  const { data, error } = await supabase.from('site_content').select('page, content');
  if (error) throw error;
  return (data ?? []) as SiteContentRow[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestedPath = typeof req.query.path === 'string' ? req.query.path : '/';
  const routePath = requestedPath !== '/' ? requestedPath.replace(/\/+$/, '') : '/';
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return sendUnavailable(res);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const productMatch = routePath.match(/^\/product\/([^/]+)$/);
    if (productMatch) {
      const routeValue = productMatch[1];
      const legacyId = productIdFromRoute(routeValue);
      const query = supabase.from('products').select('*, collections(name), fabric_care(title, body)');
      const { data: product, error } = legacyId
        ? await query.eq('id', legacyId).maybeSingle()
        : await query.eq('slug', routeValue).maybeSingle();
      if (error) return sendUnavailable(res);
      if (!product) {
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
        return sendHtml(res, 404, renderPage({
          title: `Product not found | ${SITE_NAME}`, description: SITE_DESCRIPTION, canonicalPath: routePath,
          robots: 'noindex,nofollow', jsonLd: [],
          bodyHtml: `<main><h1>Product not found</h1><p><a href="/">Return to ${SITE_NAME}</a></p></main>`,
        }));
      }
      const typedProduct = product as ServerProduct;
      const canonicalPath = productPath(typedProduct);
      if (legacyId || requestedPath !== canonicalPath) return redirectWithOriginalQuery(req, res, canonicalPath);
      const url = absoluteUrl(canonicalPath);
      const images = [typedProduct.image_front, typedProduct.image_back, ...(typedProduct.images_other ?? [])]
        .filter((src): src is string => Boolean(src)).map((src) => cloudinaryImageUrl(src, { width: 1200 }));
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
      return sendHtml(res, 200, renderPage({
        title: buildProductSearchTitle(typedProduct), description: buildProductMetaDescription(typedProduct), canonicalPath,
        image: cloudinarySocialImage(typedProduct.image_front), imageAlt: getProductImageAlt(typedProduct), ogType: 'product',
        jsonLd: [buildProductJsonLd({ ...typedProduct, image_front: images[0] ?? null,
          image_back: images[1] ?? null, images_other: images.slice(2) }, url)],
        bodyHtml: `<main><h1>${escapeHtml(typedProduct.name)}</h1><p>PKR ${Number(typedProduct.price).toLocaleString()}</p>
${typedProduct.description ? `<p>${escapeHtml(typedProduct.description)}</p>` : ''}<p>${typedProduct.available ? 'In stock' : 'Sold out'}</p>
<p>${escapeHtml(getProductHighlights(typedProduct))}</p>
${typedProduct.fabric_care?.body ? `<h2>Fabric / Care</h2><p>${escapeHtml(typedProduct.fabric_care.body)}</p>` : ''}
${renderSizeGuide(typedProduct.size_guide ?? [], typedProduct.sizes ?? [])}
${typedProduct.collections?.name ? `<p>Collection: ${escapeHtml(typedProduct.collections.name)}</p>` : ''}
${images.map((src, index) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(getProductImageAlt(typedProduct, `view ${index + 1}`))}" />`).join('\n')}
<p><a href="/">View the full collection at ${SITE_NAME}</a></p></main>`,
      }));
    }

    const rows = await loadSiteContent(supabase);
    const homeContent = rows.find((row) => row.page === 'home')?.content as { hero?: { title?: string; body?: string; media?: SiteMediaValue[] } } | undefined;
    const contactContent = rows.find((row) => row.page === 'contact')?.content as { hero?: { body?: string; media?: SiteMediaValue }; info?: Partial<ContactInfo> } | undefined;
    const shippingContent = rows.find((row) => row.page === 'shipping')?.content as { hero?: { title?: string; body?: string }; body?: string } | undefined;
    const sharedImage = firstImage(homeContent?.hero?.media);

    if (routePath === '/shipping-returns') {
      const shipping = { title: shippingContent?.hero?.title || SHIPPING_FALLBACK.title,
        body: shippingContent?.hero?.body || SHIPPING_FALLBACK.body };
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
      return sendHtml(res, 200, renderPage({
        title: `${shipping.title} | ${SITE_NAME}`, description: shipping.body, canonicalPath: '/shipping-returns',
        image: cloudinarySocialImage(sharedImage), imageAlt: 'RAR Studio women’s western co-ord collection', jsonLd: [],
        bodyHtml: `<main><h1>${escapeHtml(shipping.title)}</h1><p>${escapeHtml(shipping.body)}</p>
${(shippingContent?.body || '').split('\n\n').filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')}</main>`,
      }));
    }

    if (routePath === '/contact') {
      const info = { ...CONTACT_FALLBACK, ...(contactContent?.info ?? {}) };
      const heroBody = contactContent?.hero?.body || CONTACT_HERO_FALLBACK;
      const contactImage = contactContent?.hero?.media?.type === 'image' ? contactContent.hero.media.url : sharedImage;
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
      return sendHtml(res, 200, renderPage({
        title: `Contact | ${SITE_NAME}`, description: heroBody, canonicalPath: '/contact',
        image: cloudinarySocialImage(contactImage), imageAlt: 'Contact RAR Studio in Rawalpindi, Pakistan',
        jsonLd: [buildContactPageJsonLd(info)],
        bodyHtml: `<main><h1>Contact ${SITE_NAME}</h1><p>${escapeHtml(heroBody)}</p><ul>
<li>Email: ${escapeHtml(info.email)}</li><li>WhatsApp: ${escapeHtml(info.phone)}</li>
<li>Instagram: ${escapeHtml(info.instagram_handle)}</li><li>Location: ${escapeHtml(info.location)}</li>
</ul><p><a href="/">View the full collection at ${SITE_NAME}</a></p></main>`,
      }));
    }

    if (routePath !== '/') {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
      return sendHtml(res, 404, renderPage({
        title: `Page not found | ${SITE_NAME}`, description: SITE_DESCRIPTION, canonicalPath: routePath,
        robots: 'noindex,nofollow', jsonLd: [],
        bodyHtml: `<main><h1>Page not found</h1><p><a href="/">Return to ${SITE_NAME}</a></p></main>`,
      }));
    }

    const hero = { ...HOME_FALLBACK, title: homeContent?.hero?.title || HOME_FALLBACK.title,
      body: homeContent?.hero?.body || HOME_FALLBACK.body };
    const contactInfo = { ...CONTACT_FALLBACK, ...(contactContent?.info ?? {}) };
    const { data: products, error: productsError } = await supabase.from('products')
      .select('id, slug, name, price, description, available, size_guide, image_front, fabric_care(title, body)')
      .eq('available', true).order('created_at', { ascending: false });
    if (productsError) return sendUnavailable(res);
    const productLinks = (products ?? []) as unknown as Array<CatalogProduct & Pick<Product, 'slug' | 'price' | 'image_front'>>;
    const socialImage = cloudinarySocialImage(sharedImage || productLinks[0]?.image_front) || SITE_LOGO_URL;
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    return sendHtml(res, 200, renderPage({
      title: SITE_TITLE, description: SITE_DESCRIPTION, canonicalPath: '/', image: socialImage,
      imageAlt: 'RAR Studio women’s western co-ord collection in Pakistan',
      jsonLd: [buildOrganizationJsonLd(contactInfo), buildWebsiteJsonLd(), buildCatalogImageJsonLd(productLinks)],
      bodyHtml: `<main><h1>${escapeHtml(hero.title)}</h1><p>${escapeHtml(hero.body)}</p><p>${escapeHtml(ENTITY_DESCRIPTION)}</p>
<h2>${escapeHtml(COLLECTION_TITLE)}</h2><p>${escapeHtml(COLLECTION_INTRO)}</p><ul>
${productLinks.map((product) => {
  const thumbnail = cloudinaryCrawlerThumbnail(product.image_front);
  return `<li><a href="${escapeHtml(productPath(product))}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(getProductImageAlt(product))}" width="320" />` : ''}${escapeHtml(product.name)}</a><p>PKR ${Number(product.price).toLocaleString()}</p>${product.description ? `<p>${escapeHtml(product.description)}</p>` : ''}<p>${product.available ? 'In stock' : 'Sold out'}</p></li>`;
}).join('\n')}</ul>
${buildShoppingSections(productLinks).map((section) => `<section id="${section.id}"><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p><ul>${section.products.map((product) => `<li><a href="${escapeHtml(productPath(product))}">${escapeHtml(product.name)}</a><p>${escapeHtml(getProductSummary(product))}</p></li>`).join('')}</ul></section>`).join('')}
${productLinks.length ? `<h2>${escapeHtml(STYLING_TITLE)}</h2><p>${escapeHtml(STYLING_BODY)}</p>` : ''}
<h2>Shop by Style</h2><ul>${hero.tiles.map((tile) => `<li>${escapeHtml(tile.eyebrow)}: ${escapeHtml(tile.title)}</li>`).join('')}</ul>
<p><a href="/contact">Contact ${SITE_NAME}</a></p></main>`,
    }));
  } catch (error) {
    console.error('prerender failed', error);
    return sendUnavailable(res);
  }
}
