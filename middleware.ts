import { next, rewrite } from '@vercel/edge';

/**
 * Framework-agnostic Vercel Edge Middleware (works for this plain Vite SPA the same way it does for
 * Next.js — see @vercel/edge). It sees every path so unknown public URLs can receive a real 404;
 * static assets, APIs, checkout, orders and admin are passed through immediately.
 *
 * Every indexable storefront request receives the same crawlable Vite shell, regardless of user
 * agent. Legacy product URLs are resolved by UUID before they reach that canonical shell.
 */
export const config = {
  matcher: '/:path*',
};

const APP_ONLY_PATH = /^\/(?:admin(?:\/|$)|checkout\/?$|login\/?$|order\/(?:confirmation|cancelled)\/)/;
const PLATFORM_OR_ASSET_PATH = /^\/(?:api|assets|_vercel|\.well-known)(?:\/|$)/;
const FILE_PATH = /\/[^/]+\.[a-z0-9]{2,8}$/i;

export default function middleware(req: Request) {
  const url = new URL(req.url);

  if (url.hostname === 'www.rarstudio.co') {
    url.hostname = 'rarstudio.co';
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url, 308);
  }

  // Keep application-only routes and static files on the normal Vite/Vercel path. Every other
  // public path reaches prerender, where the allow-list returns either authoritative HTML or 404.
  if (APP_ONLY_PATH.test(url.pathname) || PLATFORM_OR_ASSET_PATH.test(url.pathname) || FILE_PATH.test(url.pathname)) {
    return next();
  }

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
