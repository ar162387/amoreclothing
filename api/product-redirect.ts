import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { productIdFromRoute, productPath } from '../src/lib/productUrl.js';

/** Preserve old shared/indexed UUID links with an HTTP redirect, for visitors and crawlers. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? productIdFromRoute(req.query.id) : null;
  if (!id) return res.status(404).send('Product not found');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(503).setHeader('Retry-After', '60').setHeader('Cache-Control', 'no-store').send('Please try again shortly');
  const { data, error } = await createClient(url, key).from('products').select('id, name, slug').eq('id', id).maybeSingle();
  if (error) return res.status(503).setHeader('Retry-After', '60').setHeader('Cache-Control', 'no-store').send('Please try again shortly');
  if (!data) return res.status(404).send('Product not found');
  const requestUrl = new URL(req.url || '/', 'https://rarstudio.co');
  requestUrl.searchParams.delete('id');
  const query = requestUrl.searchParams.toString();
  const location = `${productPath(data)}${query ? `?${query}` : ''}`;
  return res.status(301).setHeader('Location', location)
    .setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600').end();
}
