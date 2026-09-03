/**
 * Cloudinary delivery-URL transforms. This is the ONE place that knows how to turn a stored
 * Cloudinary URL into a resized/re-encoded variant, so every consumer (React components, the
 * bot-prerender function, the sitemap function) calls a plain function instead of hand-building
 * transform strings.
 *
 * Deliberately env-free and dependency-free so it is safe to import from BOTH the browser bundle
 * (Vite) and the Vercel serverless functions (esbuild/@vercel/node) — the cloud name is already
 * embedded in the stored URL, so nothing here needs `import.meta.env` or `process.env`.
 *
 * A stored product/site image URL looks like:
 *   https://res.cloudinary.com/<cloud>/image/upload/v1699999999/products/abc123.jpg
 * We splice the transform segment in right after `/upload/`:
 *   https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,c_limit,w_640,dpr_auto/v1699999999/products/abc123.jpg
 *
 * Anything that is not a Cloudinary `/upload/` URL (a local bundled asset, a leftover Supabase URL
 * from before the migration, an empty string) is returned untouched — this must never be the reason
 * an image fails to render.
 */

const UPLOAD_SEGMENT = '/image/upload/';
const VIDEO_UPLOAD_SEGMENT = '/video/upload/';

// Fixed breakpoint list. Bounds how many distinct derived variants Cloudinary ever has to generate
// per image (each first hit is one "transformation" credit; every hit after is a cheap CDN read),
// and keeps `srcset` widths landing on the same handful of cached variants across the whole site.
export const WIDTH_BREAKPOINTS = [96, 160, 320, 480, 640, 828, 1080, 1280, 1600, 2000, 2560, 3200];

export function snapWidth(width: number): number {
  return WIDTH_BREAKPOINTS.find((bp) => bp >= width) ?? WIDTH_BREAKPOINTS[WIDTH_BREAKPOINTS.length - 1];
}

export interface CloudinaryTransformOptions {
  /** Target display width in CSS px. Snapped to WIDTH_BREAKPOINTS. */
  width: number;
  /** `auto` (default) lets Cloudinary pick a quality; `auto:best` for the zoomable full-screen viewer. */
  quality?: 'auto' | 'auto:best' | 'auto:good' | 'auto:eco';
  /** `limit` (default) never upscales; `fill` + a height would hard-crop (not used yet). */
  crop?: 'limit' | 'fit' | 'fill';
}

function spliceTransform(url: string, segment: string, transform: string): string {
  const at = url.indexOf(segment);
  if (at === -1) return url;
  const head = url.slice(0, at + segment.length);
  const tail = url.slice(at + segment.length);
  // If a transform block is already present (starts right after /upload/ and ends before the next
  // `/`), replace it rather than stacking a second one.
  const firstSlash = tail.indexOf('/');
  const maybeExisting = firstSlash === -1 ? '' : tail.slice(0, firstSlash);
  const looksLikeTransform = /(^|,)(f_|q_|w_|h_|c_|dpr_|e_|g_)/.test(maybeExisting);
  const rest = looksLikeTransform ? tail.slice(firstSlash + 1) : tail;
  return `${head}${transform}/${rest}`;
}

/** Resized/auto-format variant of a stored Cloudinary image URL, or the URL unchanged if it isn't
 * one (or is empty). Safe to call on any image field without checking first. */
export function cloudinaryImageUrl(
  url: string | null | undefined,
  { width, quality = 'auto', crop = 'limit' }: CloudinaryTransformOptions,
): string {
  if (!url) return '';
  if (!url.includes(UPLOAD_SEGMENT)) return url;
  const transform = `f_auto,q_${quality},c_${crop},w_${snapWidth(width)},dpr_auto`;
  return spliceTransform(url, UPLOAD_SEGMENT, transform);
}

/** `srcset`-ready string across a list of widths. Returns undefined for non-Cloudinary URLs so the
 * caller can fall back to a plain `src`. */
export function cloudinaryImageSrcSet(
  url: string | null | undefined,
  widths: number[],
  quality: CloudinaryTransformOptions['quality'] = 'auto',
): string | undefined {
  if (!url || !url.includes(UPLOAD_SEGMENT)) return undefined;
  return widths
    .map((width) => `${cloudinaryImageUrl(url, { width, quality })} ${snapWidth(width)}w`)
    .join(', ');
}

/** Poster/first-frame or lightly-capped delivery URL for a stored Cloudinary video. Non-Cloudinary
 * URLs pass through untouched. */
export function cloudinaryVideoUrl(
  url: string | null | undefined,
  { width = 1280 }: { width?: number } = {},
): string {
  if (!url) return '';
  if (!url.includes(VIDEO_UPLOAD_SEGMENT)) return url;
  return spliceTransform(url, VIDEO_UPLOAD_SEGMENT, `q_auto,c_limit,w_${width}`);
}
