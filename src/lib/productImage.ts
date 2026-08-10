/**
 * Builds URLs for the on-the-fly image-resize proxy (api/image.ts) — the ONE place in the app that
 * knows its query-param shape, so every consumer just calls a plain function instead of hand-building
 * `/api/image?...` strings. See api/image.ts for the server-side contract/validation.
 *
 * Falls back to the raw URL unchanged for anything that isn't a Supabase product-storage URL (a local
 * bundled asset, some future external source, etc.) — this must never be the reason an image fails to
 * render, so when in doubt it's a no-op.
 *
 * Also falls back to the raw URL in local dev (`vite dev`/`npm run dev`): `/api/image` is a Vercel
 * serverless function, which plain `vite dev` never runs (they only exist once deployed, or under
 * `vercel dev`) — without this, every proxied image would just 404 on localhost. Production builds
 * (`import.meta.env.DEV === false`) always go through the proxy as normal.
 */

const STORAGE_PREFIX = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/storage/v1/object/public/products/`;
const PROXY_ENABLED = !import.meta.env.DEV;

// Mirrors the server's own breakpoint list (api/image.ts) — keeping the client's choice on this list
// means a given rendered width always lands on a cache HIT rather than a fresh server-side snap.
const WIDTH_BREAKPOINTS = [96, 160, 320, 480, 640, 828, 1080, 1280, 1600, 2000, 2560, 3200];

function snapWidth(width: number): number {
  return WIDTH_BREAKPOINTS.find((bp) => bp >= width) ?? WIDTH_BREAKPOINTS[WIDTH_BREAKPOINTS.length - 1];
}

/** Resized/WebP-converted URL for a stored product photo, or the original URL unchanged if it isn't
 * one (or is empty) — safe to call on any image field without checking first. */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number,
  quality?: 'hi',
): string {
  if (!url) return '';
  if (!PROXY_ENABLED || !url.startsWith(STORAGE_PREFIX)) return url;

  const path = url.slice(STORAGE_PREFIX.length);
  const params = new URLSearchParams({ path, w: String(snapWidth(width)) });
  if (quality === 'hi') params.set('q', 'hi');
  return `/api/image?${params.toString()}`;
}

/** `srcset`-ready string across a list of widths, for the consumers that render responsively
 * (product grid, PDP gallery, fullscreen viewer). Non-proxied URLs collapse to a single 1x entry. */
export function buildSrcSet(
  url: string | null | undefined,
  widths: number[],
  quality?: 'hi',
): string | undefined {
  if (!url) return undefined;
  if (!PROXY_ENABLED || !url.startsWith(STORAGE_PREFIX)) return undefined;

  return widths
    .map((width) => `${getOptimizedImageUrl(url, width, quality)} ${snapWidth(width)}w`)
    .join(', ');
}
