import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Issues a short-lived signature for a Cloudinary *signed* upload. The browser never sees
 * CLOUDINARY_API_SECRET — it asks this route for a `{ timestamp, signature }` pair, then POSTs the
 * file straight to Cloudinary. Same split-secret shape as the Safepay signing in
 * server/paymentApi.ts.
 *
 * Gated on a valid Supabase session: uploads only happen from the admin panel, which is behind
 * Supabase Auth, and this project has exactly one (admin) user, so "is there a logged-in user" is a
 * sufficient check. Without this gate the endpoint would be an open door to your Cloudinary quota.
 *
 * `process.env` only — `@/` and extension-less relative imports do NOT resolve in api/*.ts at
 * runtime (see server/paymentApi.ts's header comment).
 */

// Params the client will send to Cloudinary that must be covered by the signature. Cloudinary's
// rule: sign every upload param EXCEPT `file`, `cloud_name`, `api_key`, `resource_type` — sorted by
// key, joined `k=v` with `&`, then append the API secret and SHA-1 the whole string.
function sign(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

const ALLOWED_FOLDERS = new Set(['products', 'site']);

// Incoming transformation for image uploads: cap the STORED original at 3200px longest edge and let
// Cloudinary re-encode at an automatic quality. This replaces the old browser-side canvas compression
// (which blocked the main thread for minutes on big camera files) — the resize happens on
// Cloudinary's servers instead, so the browser just does a plain file upload. 3200px still exceeds
// every viewport this site renders on, including the full-screen viewer's 2560px zoom request.
const IMAGE_INCOMING_TRANSFORM = 'c_limit,w_3200/q_auto:good';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    console.error('cloudinary-sign: missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }

  // --- auth: require a valid Supabase session -------------------------------
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!supabaseUrl || !anonKey) {
    console.error('cloudinary-sign: missing SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
    res.status(500).json({ error: 'server misconfigured' });
    return;
  }
  if (!token) {
    res.status(401).json({ error: 'not authenticated' });
    return;
  }
  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: 'not authenticated' });
    return;
  }

  // --- issue signature ----------------------------------------------------
  const requestedFolder = typeof req.body?.folder === 'string' ? req.body.folder : 'products';
  const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : 'products';
  const resourceType = req.body?.resourceType === 'video' ? 'video' : 'image';
  const timestamp = Math.floor(Date.now() / 1000);

  // Only images get the size-capping incoming transform; videos upload as-is.
  const transformation = resourceType === 'image' ? IMAGE_INCOMING_TRANSFORM : '';
  const signature = sign({ folder, timestamp, transformation }, apiSecret);

  res.status(200).json({ cloudName, apiKey, timestamp, signature, folder, transformation });
}
