import { next, rewrite } from '@vercel/edge';

/**
 * Framework-agnostic Vercel Edge Middleware (works for this plain Vite SPA the same way it does for
 * Next.js — see @vercel/edge). Scoped to only the routes that matter for SEO/GEO: everything else
 * (static assets, /checkout, /admin, etc.) never even reaches this function.
 *
 * Real visitors are completely unaffected — `next()` is a pure passthrough to the normal static SPA.
 * Only requests whose User-Agent matches a known bot get rewritten to api/prerender.ts, which returns
 * real server-rendered HTML instead of the SPA's empty `<div id="root">` shell.
 */
export const config = {
  matcher: ['/', '/contact', '/product/:path*'],
};

// Search engines, AI answer engines / GEO crawlers, and social share-preview bots — none of these
// execute JavaScript, so without this middleware they see nothing but a bare page shell.
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|embedly|quora link preview|pinterest|redditbot|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|anthropic-ai|perplexitybot|perplexity-user|google-extended|ccbot|bytespider|diffbot|semrushbot|ahrefsbot|mj12bot|dotbot|yandexbot|baiduspider|duckduckbot/i;

export default function middleware(req: Request) {
  const userAgent = req.headers.get('user-agent') || '';
  if (!BOT_UA_PATTERN.test(userAgent)) {
    return next();
  }

  const url = new URL(req.url);
  const target = new URL('/api/prerender', url);
  target.searchParams.set('path', url.pathname);
  return rewrite(target);
}
