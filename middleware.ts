import { rewrite } from '@vercel/edge';

/**
 * Framework-agnostic Vercel Edge Middleware (works for this plain Vite SPA the same way it does for
 * Next.js — see @vercel/edge). Scoped to only the routes that matter for SEO/GEO: everything else
 * (static assets, /checkout, /admin, etc.) never even reaches this function.
 *
 * Every indexable storefront request receives the same crawlable Vite shell, regardless of user
 * agent. Legacy product URLs are resolved by UUID before they reach that canonical shell.
 */
export const config = {
  matcher: ['/', '/contact', '/collections/:path*', '/product/:path*', '/shipping-returns'],
};

export default function middleware(req: Request) {
  const url = new URL(req.url);
  if (/^\/collections\/?$/.test(url.pathname)) {
    return Response.redirect(new URL(`/${url.search}`, url), 301);
  }

  const legacyProduct = url.pathname.match(/^\/product\/(?:.*-)?([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i);
  if (legacyProduct) {
    const target = new URL(url);
    target.pathname = '/api/product-redirect';
    target.searchParams.set('id', legacyProduct[1]);
    return rewrite(target);
  }

  const target = new URL(url);
  target.pathname = '/api/prerender';
  target.searchParams.set('path', url.pathname);
  return rewrite(target);
}
