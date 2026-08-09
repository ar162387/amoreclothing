import { useEffect } from 'react';

/**
 * Marks the current page as noindex,nofollow for the duration it's mounted,
 * so it stays reachable by direct URL but is excluded from search engine
 * results. Removes the tag on unmount so it never leaks onto other routes
 * (there's no per-route head management in this app — see index.html for
 * the shared, indexable defaults).
 */
export function useNoIndex() {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const existed = Boolean(meta);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const previousContent = meta.content;
    meta.content = 'noindex, nofollow';

    return () => {
      if (!meta) return;
      if (existed) {
        meta.content = previousContent;
      } else {
        meta.remove();
      }
    };
  }, []);
}
