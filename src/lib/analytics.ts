/**
 * Google Analytics 4 (gtag.js) for the public storefront.
 *
 * Loaded once from main.tsx rather than hard-coded into index.html so that:
 *   - it never runs on localhost or *.vercel.app preview builds (hostname guard below),
 *   - /admin and /login are excluded from page_view tracking,
 *   - there is exactly one Google tag on the page (per GA's own warning).
 *
 * A GA4 Measurement ID is not a secret (it is visible in the network requests of every
 * GA-instrumented site), so a literal default is fine. Set VITE_GA_MEASUREMENT_ID to point at a
 * different property, or to an empty string to disable analytics entirely.
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? 'G-GL8YXM550L';

// Only the real production hostname reports. Everything else loads nothing.
const ANALYTICS_HOSTS = new Set(['rarstudio.co', 'www.rarstudio.co']);

let enabled = false;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// gtag.js reads each dataLayer entry as an argument list; an array works the same as the canonical
// snippet's `arguments` object (this is what react-ga4 / the official Next.js example do too).
function gtag(...args: unknown[]) {
  window.dataLayer.push(args);
}

export function initAnalytics(): void {
  if (enabled || typeof window === 'undefined') return;
  if (!GA_ID || !ANALYTICS_HOSTS.has(window.location.hostname)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;

  gtag('js', new Date());
  // page_view is sent manually per route (see trackPageView) so SPA navigations are counted
  // and /admin can be skipped.
  gtag('config', GA_ID, { send_page_view: false });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  enabled = true;
}

const isPublicPath = (path: string) => !path.startsWith('/admin') && path !== '/login';

export function trackPageView(path: string): void {
  if (!enabled || !isPublicPath(path)) return;
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!enabled) return;
  window.gtag?.('event', name, params);
}

// --- ecommerce ------------------------------------------------------------------

interface ProductLike {
  id: string;
  name: string;
  price: number | string;
  collections?: { name?: string } | null;
}

const toItem = (p: ProductLike, extra: Record<string, unknown> = {}) => ({
  item_id: p.id,
  item_name: p.name,
  price: Number(p.price) || 0,
  ...(p.collections?.name ? { item_category: p.collections.name } : {}),
  ...extra,
});

/** Fired when a product detail page is opened. The primary "which products get attention" signal. */
export function trackViewItem(p: ProductLike): void {
  trackEvent('view_item', { currency: 'PKR', value: Number(p.price) || 0, items: [toItem(p)] });
}

/** Fired when a product card in a listing is clicked through to its detail page. */
export function trackSelectItem(p: ProductLike, listName: string): void {
  trackEvent('select_item', { item_list_name: listName, items: [toItem(p, { item_list_name: listName })] });
}

/** Fired once when a product listing (the storefront grid) is rendered. */
export function trackViewItemList(products: ProductLike[], listName: string): void {
  if (!products.length) return;
  trackEvent('view_item_list', {
    item_list_name: listName,
    items: products.map((p, i) => toItem(p, { item_list_name: listName, index: i })),
  });
}

export function trackAddToCart(p: ProductLike, size: string, quantity = 1): void {
  trackEvent('add_to_cart', {
    currency: 'PKR',
    value: (Number(p.price) || 0) * quantity,
    items: [toItem(p, { item_variant: size, quantity })],
  });
}

export function trackBeginCheckout(
  items: { product: ProductLike; size: string; quantity: number }[],
  value: number,
): void {
  if (!items.length) return;
  trackEvent('begin_checkout', {
    currency: 'PKR',
    value,
    items: items.map(({ product, size, quantity }) => toItem(product, { item_variant: size, quantity })),
  });
}

export function trackPurchase(args: {
  transactionId: string;
  value: number;
  shipping: number;
  currency: string;
  items: { name: string; size: string; quantity: number; price: number }[];
}): void {
  trackEvent('purchase', {
    transaction_id: args.transactionId,
    value: args.value,
    shipping: args.shipping,
    currency: args.currency || 'PKR',
    items: args.items.map((it) => ({
      item_id: it.name,
      item_name: it.name,
      item_variant: it.size,
      quantity: it.quantity,
      price: it.price,
    })),
  });
}
