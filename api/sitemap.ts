import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://rarstudio.co';

interface SitemapUrl {
  loc: string;
  priority: string;
  lastmod?: string;
}

/**
 * Dynamic sitemap: the static routes are known up front, but every product
 * page is sourced live from Supabase (same anon-key client the app itself
 * uses — Vercel exposes project env vars to serverless functions regardless
 * of the `VITE_` prefix, so no separate secret is needed here). Regenerated
 * per-request (cached at the edge, see Cache-Control below), so a new
 * product shows up in the sitemap without a redeploy.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const urls: SitemapUrl[] = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/contact`, priority: '0.6' },
  ];

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from('products')
        .select('id, created_at')
        .eq('available', true);

      if (error) throw error;

      (data ?? []).forEach((product) => {
        urls.push({
          loc: `${SITE_URL}/product/${product.id}`,
          priority: '0.8',
          lastmod: product.created_at ? new Date(product.created_at).toISOString() : undefined,
        });
      });
    } catch (error) {
      // Degrade to the static routes rather than a hard failure — a sitemap
      // missing products is far better than a sitemap that 500s outright.
      console.error('sitemap: failed to load products', error);
    }
  } else {
    console.error('sitemap: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }

  const body = urls
    .map(
      (url) =>
        `  <url>\n    <loc>${url.loc}</loc>\n` +
        (url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>\n` : '') +
        `    <priority>${url.priority}</priority>\n  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
