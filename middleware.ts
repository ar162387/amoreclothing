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
  matcher: ['/', '/contact', '/product/:path*', '/shipping-returns'],
};

// Search engines, AI answer engines / GEO crawlers, and social share-preview bots we WANT to serve
// real HTML to — none execute JavaScript, so without this they see only a bare page shell.
const BOT_UA_PATTERN =
  /googlebot|bingbot|applebot|duckduckbot|yandexbot|baiduspider|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|embedly|quora link preview|pinterest|redditbot|slackbot|gptbot|chatgpt-user|oai-searchbot|claudebot|anthropic-ai|perplexitybot|perplexity-user|google-extended|ccbot/i;

// SEO-audit / data-mining crawlers that hammer every image URL and give us nothing back. They get
// the plain SPA shell (and are Disallowed in robots.txt) so they never pull a single media byte.
const BLOCKED_BOT_UA_PATTERN =
  /ahrefsbot|semrushbot|mj12bot|dotbot|bytespider|diffbot|petalbot|dataforseobot|blexbot|serpstatbot|megaindex/i;

export default function middleware(req: Request) {
  const userAgent = req.headers.get('user-agent') || '';
  if (BLOCKED_BOT_UA_PATTERN.test(userAgent) || !BOT_UA_PATTERN.test(userAgent)) {
    return next();
  }

  const url = new URL(req.url);
  const target = new URL('/api/prerender', url);
  target.searchParams.set('path', url.pathname);
  return rewrite(target);
}
