import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  absoluteUrl,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  buildContactPageJsonLd,
  buildProductJsonLd,
  buildProductMetaDescription,
} from '../src/lib/seo.js';
import type { ContactInfo } from '../src/services/siteContent.js';
import { buildShoppingSections, COLLECTION_TITLE, COLLECTION_INTRO, getProductSummary, getProductHighlights, STYLING_TITLE, STYLING_BODY, type CatalogProduct } from '../src/lib/catalogContent.js';
import type { SizeGuide } from '../src/services/products.js';
import { cloudinaryImageUrl } from '../src/lib/cloudinary.js';
import { productIdFromRoute, productPath } from '../src/lib/productUrl.js';

/**
 * Serves real, crawlable HTML to bots that don't execute JavaScript (GPTBot, ClaudeBot,
 * PerplexityBot, CCBot, facebookexternalhit, Twitterbot, ...) — see middleware.ts, which is what
 * routes bot traffic here in the first place. Everyone else keeps hitting the static SPA directly;
 * this function is never in a real visitor's path.
 *
 * Minimal hand-written HTML templates, not React SSR — bots only need correct <title>/meta/JSON-LD
 * and readable text, not interactivity, and this avoids duplicating the app's component tree in a
 * second rendering path.
 *
 * Fallback copy below is a small, deliberately duplicated subset of src/config/siteContent.defaults.ts
 * — that file can't be imported here because it pulls in Vite's `@/assets/*.jpg` asset-URL imports,
 * which this function's bundler (esbuild, via @vercel/node) can't resolve. Keep the two loosely in
 * sync by hand; this only matters while the site_content DB row is empty.
 */

const HOME_FALLBACK = {
  title: 'Timeless Elegance',
  body: 'Discover our debut collection of refined essentials, crafted for the modern woman.',
  tiles: [
    { eyebrow: 'Effortless Style', title: 'Day to Evening' },
    { eyebrow: 'Sophisticated Elegance', title: 'Evening Wear' },
  ],
};

const CONTACT_FALLBACK: ContactInfo = {
  email: 'hello@rarstudio.co',
  phone: '+92 300 1234567',
  instagram_handle: '@rarstudio',
  instagram_url: 'https://instagram.com',
  location: 'Lahore, Pakistan',
  whatsapp_message: 'Hello! I have a question about RAR Studio.',
};

const CONTACT_HERO_FALLBACK =
  "We'd love to hear from you. Send us a message and we'll respond as soon as possible.";

const SHIPPING_FALLBACK = {
  title: 'Shipping, Exchange & Return',
  body: 'Everything you need to know about delivery, exchanges, and returns.',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSizeGuide(heads: SizeGuide, sizes: string[]): string {
  if (!sizes.length) return '';
  const tables = heads.filter((head) => head.label && head.rows.length).map((head) => `
<h3>${escapeHtml(head.label)}</h3>
<table><thead><tr><th scope="col">Measurement</th>${sizes.map((size) => `<th scope="col">${escapeHtml(size)}</th>`).join('')}</tr></thead>
<tbody>${head.rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th>${sizes.map((size) => `<td>${escapeHtml(row.values[size] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('');
  return tables ? `<h2>Size Guide</h2><p>Measurements are garment measurements, not body measurements.</p>${tables}` : '';
}

interface PageOptions {
  title: string;
  description: string;
  canonicalPath: string;
  image?: string;
  jsonLd: object[];
  bodyHtml: string;
}

function renderPage({ title, description, canonicalPath, image, jsonLd, bodyHtml }: PageOptions): string {
  const canonical = absoluteUrl(canonicalPath);
  const jsonLdScripts = jsonLd
    .map((data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:url" content="${canonical}" />
${image ? `<meta property="og:image" content="${image}" />\n` : ''}<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
${jsonLdScripts}
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function sendHtml(res: VercelResponse, status: number, html: string) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = typeof req.query.path === 'string' ? req.query.path : '/';
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

  // Cheap re-checks on a crawl burst don't need to hit Supabase every time.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600');

  const productMatch = path.match(/^\/product\/([^/]+)\/?$/);

  // --- Product page ---------------------------------------------------
  if (productMatch) {
    const id = productIdFromRoute(productMatch[1]);
    const { data: product, error } = supabase
      ? id
        ? await supabase.from('products').select('*, collections(name), fabric_care(title, body)').eq('id', id).single()
        : { data: null, error: new Error('Invalid product route') }
      : { data: null, error: new Error('Supabase not configured') };

    if (error || !product) {
      sendHtml(
        res,
        404,
        renderPage({
          title: `Product not found | ${SITE_NAME}`,
          description: SITE_DESCRIPTION,
          canonicalPath: '/',
          jsonLd: [],
          bodyHtml: `<h1>Product not found</h1><p><a href="/">Return to ${escapeHtml(SITE_NAME)}</a></p>`,
        }),
      );
      return;
    }

    // Bots get Cloudinary-resized variants, never the multi-MB stored original — an un-capped image
    // in crawlable HTML / the image sitemap is exactly what ran the old backend's egress quota dry.
    const images: string[] = [product.image_front, product.image_back, ...(product.images_other ?? [])]
      .filter((src): src is string => Boolean(src))
      .map((src) => cloudinaryImageUrl(src, { width: 1200 }));
    const canonicalPath = productPath(product);
    const url = absoluteUrl(canonicalPath);

    sendHtml(
      res,
      200,
      renderPage({
        title: `${product.name} | ${SITE_NAME}`,
        description: buildProductMetaDescription(product),
        canonicalPath,
        image: product.image_front ? absoluteUrl(cloudinaryImageUrl(product.image_front, { width: 1200 })) : undefined,
        jsonLd: [buildProductJsonLd({ ...product, image_front: images[0] ?? null, image_back: images[1] ?? null, images_other: images.slice(2) }, url)],
        bodyHtml: `
<h1>${escapeHtml(product.name)}</h1>
<p>PKR ${Number(product.price).toLocaleString()}</p>
${product.description ? `<p>${escapeHtml(product.description)}</p>\n` : ''}<p>${product.available ? 'In stock' : 'Sold out'}</p>
<p>${escapeHtml(getProductHighlights(product))}</p>
${product.fabric_care?.body ? `<h2>Fabric / Care</h2><p style="white-space:pre-line">${escapeHtml(product.fabric_care.body)}</p>` : ''}
${renderSizeGuide(product.size_guide ?? [], product.sizes ?? [])}
${product.collections?.name ? `<p>Collection: ${escapeHtml(product.collections.name)}</p>\n` : ''}${images
          .map((src, i) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} - view ${i + 1}" />`)
          .join('\n')}
<p><a href="/">View the full collection at ${escapeHtml(SITE_NAME)}</a></p>`,
      }),
    );
    return;
  }

  // --- Shipping, Exchange & Return page -------------------------------------
  if (path === '/shipping-returns') {
    let shipping = SHIPPING_FALLBACK;
    let body = '';

    if (supabase) {
      const { data } = await supabase.from('site_content').select('content').eq('page', 'shipping').maybeSingle();
      const content = (data?.content ?? {}) as Partial<{ hero?: { title?: string; body?: string }; body?: string }>;
      if (content.hero?.title || content.hero?.body) {
        shipping = { title: content.hero.title || shipping.title, body: content.hero.body || shipping.body };
      }
      if (content.body) body = content.body;
    }

    sendHtml(
      res,
      200,
      renderPage({
        title: `${shipping.title} | ${SITE_NAME}`,
        description: shipping.body,
        canonicalPath: '/shipping-returns',
        jsonLd: [],
        bodyHtml: `
<h1>${escapeHtml(shipping.title)}</h1>
<p>${escapeHtml(shipping.body)}</p>
${body
  .split('\n\n')
  .filter(Boolean)
  .map((para) => `<p>${escapeHtml(para)}</p>`)
  .join('\n')}`,
      }),
    );
    return;
  }

  // --- Contact page ----------------------------------------------------
  if (path === '/contact') {
    let info = CONTACT_FALLBACK;
    let heroBody = CONTACT_HERO_FALLBACK;

    if (supabase) {
      const { data } = await supabase.from('site_content').select('content').eq('page', 'contact').maybeSingle();
      const content = (data?.content ?? {}) as Partial<{ hero?: { body?: string }; info?: Partial<ContactInfo> }>;
      if (content.info) info = { ...CONTACT_FALLBACK, ...content.info };
      if (content.hero?.body) heroBody = content.hero.body;
    }

    sendHtml(
      res,
      200,
      renderPage({
        title: `Contact | ${SITE_NAME}`,
        description: heroBody,
        canonicalPath: '/contact',
        jsonLd: [buildContactPageJsonLd(info)],
        bodyHtml: `
<h1>Contact ${escapeHtml(SITE_NAME)}</h1>
<p>${escapeHtml(heroBody)}</p>
<ul>
<li>Email: ${escapeHtml(info.email)}</li>
<li>WhatsApp: ${escapeHtml(info.phone)}</li>
<li>Instagram: ${escapeHtml(info.instagram_handle)}</li>
<li>Location: ${escapeHtml(info.location)}</li>
</ul>
<p><a href="/">View the full collection at ${escapeHtml(SITE_NAME)}</a></p>`,
      }),
    );
    return;
  }

  // --- Home page ---------------------------------------------------------
  let hero = HOME_FALLBACK;
  let contactInfo = CONTACT_FALLBACK;
  let productLinks: CatalogProduct[] = [];

  if (supabase) {
    const { data } = await supabase.from('site_content').select('page, content');
    const homeContent = data?.find((row) => row.page === 'home')?.content as
      | Partial<{ hero?: { title?: string; body?: string } }>
      | undefined;
    const contactContent = data?.find((row) => row.page === 'contact')?.content as
      | Partial<{ info?: Partial<ContactInfo> }>
      | undefined;

    if (homeContent?.hero?.title || homeContent?.hero?.body) {
      hero = {
        ...hero,
        title: homeContent.hero?.title || hero.title,
        body: homeContent.hero?.body || hero.body,
      };
    }
    if (contactContent?.info) contactInfo = { ...CONTACT_FALLBACK, ...contactContent.info };

    const { data: products } = await supabase
      .from('products')
      .select('id, name, description, available, size_guide, fabric_care(title, body)')
      .eq('available', true)
      .order('created_at', { ascending: false });
    productLinks = (products ?? []) as unknown as CatalogProduct[];
  }

  sendHtml(
    res,
    200,
    renderPage({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      canonicalPath: '/',
      jsonLd: [buildOrganizationJsonLd(contactInfo), buildWebsiteJsonLd()],
      bodyHtml: `
<h1>${escapeHtml(hero.title)}</h1>
<p>${escapeHtml(hero.body)}</p>
<h2>${escapeHtml(COLLECTION_TITLE)}</h2>
<p>${escapeHtml(COLLECTION_INTRO)}</p>
<ul>
${productLinks.map((product) => `<li><a href="${escapeHtml(productPath(product))}">${escapeHtml(product.name)}</a></li>`).join('\n')}
</ul>
${buildShoppingSections(productLinks).map((section) => `<section id="${section.id}">
<h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>
<ul>${section.products.map((product) => `<li><a href="${escapeHtml(productPath(product))}">${escapeHtml(product.name)}</a><p>${escapeHtml(getProductSummary(product))}</p></li>`).join('')}</ul>
</section>`).join('')}
${productLinks.length ? `<h2>${escapeHtml(STYLING_TITLE)}</h2><p>${escapeHtml(STYLING_BODY)}</p>` : ''}
<h2>Shop by Style</h2>
<ul>
${hero.tiles.map((tile) => `<li>${escapeHtml(tile.eyebrow)}: ${escapeHtml(tile.title)}</li>`).join('\n')}
</ul>
<p><a href="/contact">Contact ${escapeHtml(SITE_NAME)}</a></p>`,
    }),
  );
}
