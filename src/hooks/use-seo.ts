import { useEffect } from 'react';
import { absoluteUrl } from '@/lib/seo';

export interface UseSeoOptions {
  title: string;
  description: string;
  /** Route path (e.g. "/contact") — resolved to an absolute canonical URL. */
  canonicalPath: string;
  /** Absolute image URL for social previews. Omit to leave the site-wide default og:image untouched. */
  image?: string;
  /** One or more JSON-LD objects, each rendered as its own <script type="application/ld+json">. */
  jsonLd?: object | object[];
}

/** Creates the meta tag if missing, patches it if present, and returns a cleanup that restores
 * whichever state it found (matches the pattern in src/hooks/use-no-index.ts). */
function patchMeta(selector: string, makeAttrs: () => Record<string, string>, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  const existed = Boolean(el);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(makeAttrs()).forEach(([key, value]) => el!.setAttribute(key, value));
    document.head.appendChild(el);
  }
  const previous = el.getAttribute('content') ?? '';
  el.setAttribute('content', content);
  return () => {
    if (!el) return;
    if (existed) el.setAttribute('content', previous);
    else el.remove();
  };
}

function patchLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  const existed = Boolean(el);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  const previous = el.href;
  el.href = href;
  return () => {
    if (!el) return;
    if (existed) el.href = previous;
    else el.remove();
  };
}

/**
 * Per-route document head management: title, meta description, canonical link, Open Graph / Twitter
 * tags, and JSON-LD structured data. Only called from pages that are meant to be indexable — About
 * still uses useNoIndex instead, not this.
 *
 * Same imperative create-or-patch-then-restore approach as useNoIndex: every tag either already exists
 * (from index.html's shared defaults) and gets patched then restored, or gets created fresh and removed,
 * so SPA navigation away from an SEO-aware page never leaks a stale title/description onto the next one.
 */
export function useSeo({ title, description, canonicalPath, image, jsonLd }: UseSeoOptions) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const canonical = absoluteUrl(canonicalPath);
    const previousTitle = document.title;
    document.title = title;

    const cleanups: Array<() => void> = [
      patchMeta('meta[name="description"]', () => ({ name: 'description' }), description),
      patchMeta('meta[property="og:title"]', () => ({ property: 'og:title' }), title),
      patchMeta('meta[property="og:description"]', () => ({ property: 'og:description' }), description),
      patchMeta('meta[property="og:url"]', () => ({ property: 'og:url' }), canonical),
      patchMeta('meta[name="twitter:title"]', () => ({ name: 'twitter:title' }), title),
      patchMeta('meta[name="twitter:description"]', () => ({ name: 'twitter:description' }), description),
      patchLink('canonical', canonical),
    ];

    if (image) {
      cleanups.push(patchMeta('meta[property="og:image"]', () => ({ property: 'og:image' }), image));
      cleanups.push(patchMeta('meta[name="twitter:image"]', () => ({ name: 'twitter:image' }), image));
    }

    const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
    const scripts = jsonLdList.map((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
      return script;
    });

    return () => {
      document.title = previousTitle;
      cleanups.forEach((cleanup) => cleanup());
      scripts.forEach((script) => script.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonicalPath, image, jsonLdKey]);
}
