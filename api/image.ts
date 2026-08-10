import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

/**
 * On-the-fly product-photo resize proxy. Fetches the ORIGINAL from Supabase Storage server-side,
 * resizes/re-encodes to WebP at a request-specific width, and returns it with long-lived immutable
 * caching. Strictly read-through — never writes back to storage, never touches the source file.
 *
 * This exists because product photos are uploaded as professionally-shot camera originals (several MB,
 * 4000px+ wide) that must not be lossily re-encoded in place — see src/services/upload.ts, which only
 * compresses images uploaded from now on. This proxy is what makes every EXISTING photo (and any future
 * one, as a second line of defense) fast to serve without a storage migration/backfill step.
 *
 * Security model: the client never sends a URL or hostname — only a `path` (the object key). The
 * fetch target is always reconstructed server-side from that path plus the known bucket prefix, so
 * there is no open-proxy surface. `w`/`q` are also re-validated server-side regardless of what the
 * client-side helper (src/lib/productImage.ts) already sends, since the client can't be trusted.
 */

// Matches upload.ts's own object-key shape: "<folder>/<random>_<timestamp>.<ext>" — alphanumerics,
// dots, underscores, hyphens, forward slashes only. Blocks path traversal and anything that isn't a
// key this app itself could have produced.
const SAFE_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

// Fixed breakpoint list — bounds how many distinct (path, width) cache entries exist per image and
// blocks width-based cache-busting/abuse. 3200 mirrors MAX_IMAGE_DIMENSION in src/services/upload.ts,
// the same "you can't tell it was compressed" ceiling already chosen for new uploads.
const WIDTH_BREAKPOINTS = [96, 160, 320, 480, 640, 828, 1080, 1280, 1600, 2000, 2560, 3200];
const DEFAULT_WIDTH = 640;

function snapWidth(raw: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WIDTH;
  return WIDTH_BREAKPOINTS.find((bp) => bp >= parsed) ?? WIDTH_BREAKPOINTS[WIDTH_BREAKPOINTS.length - 1];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = typeof req.query.path === 'string' ? req.query.path : '';
  const isHiQuality = req.query.q === 'hi';

  if (!path || !SAFE_PATH.test(path)) {
    res.status(400).setHeader('Cache-Control', 'no-store').send('Invalid path');
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('image proxy: missing VITE_SUPABASE_URL');
    res.status(500).setHeader('Cache-Control', 'no-store').send('Server misconfigured');
    return;
  }

  const width = snapWidth(req.query.w);
  const quality = isHiQuality ? 85 : 80;
  const sourceUrl = `${supabaseUrl}/storage/v1/object/public/products/${path}`;

  try {
    const upstream = await fetch(sourceUrl);
    if (!upstream.ok) {
      res.status(upstream.status === 404 ? 404 : 502).setHeader('Cache-Control', 'public, max-age=60').send('Source image unavailable');
      return;
    }

    const original = Buffer.from(await upstream.arrayBuffer());
    const resized = await sharp(original)
      .rotate() // auto-orient from EXIF — camera JPEGs commonly carry an orientation tag
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    res.setHeader('Content-Type', 'image/webp');
    // Safe to cache forever: upload.ts names every object "<random>_<timestamp>.<ext>" and never
    // overwrites a key in place, so a given (path, width, quality) tuple's output never changes.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(resized);
  } catch (error) {
    console.error('image proxy: failed to process', sourceUrl, error);
    res.status(502).setHeader('Cache-Control', 'public, max-age=60').send('Failed to process image');
  }
}
