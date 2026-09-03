/**
 * Thin compatibility shim over src/lib/cloudinary.ts. Every product-image consumer in the app
 * (ProductCard, ProductDetail, CartDrawer, Header, AdminOrders, ProductFullscreenViewer) imports
 * `getOptimizedImageUrl` / `buildSrcSet` from here — keeping this surface stable meant the
 * Supabase-Storage-proxy → Cloudinary switch touched only this file, not the call sites.
 *
 * Media now lives in Cloudinary, which does the resize/format/quality work on its own CDN via URL
 * transforms (see src/lib/cloudinary.ts). There is no longer a `/api/image` serverless hop, so
 * these helpers work identically in `vite dev` and in production.
 *
 * Anything that isn't a Cloudinary `/image/upload/` URL — a local bundled asset, a leftover Supabase
 * URL from before the migration — is returned untouched.
 */

import {
  cloudinaryImageUrl,
  cloudinaryImageSrcSet,
  WIDTH_BREAKPOINTS,
} from './cloudinary';

export { WIDTH_BREAKPOINTS };

/** Resized/auto-format URL for a stored product photo, or the original URL unchanged if it isn't a
 * Cloudinary URL (or is empty). `quality: 'hi'` maps to Cloudinary's `q_auto:best`, for the
 * pinch-zoomable full-screen viewer. */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number,
  quality?: 'hi',
): string {
  return cloudinaryImageUrl(url, {
    width,
    quality: quality === 'hi' ? 'auto:best' : 'auto',
  });
}

/** `srcset`-ready string across a list of widths, for the consumers that render responsively
 * (product grid, PDP gallery, fullscreen viewer). Returns undefined for non-Cloudinary URLs so the
 * caller falls back to a plain `src`. */
export function buildSrcSet(
  url: string | null | undefined,
  widths: number[],
  quality?: 'hi',
): string | undefined {
  return cloudinaryImageSrcSet(url, widths, quality === 'hi' ? 'auto:best' : 'auto');
}
