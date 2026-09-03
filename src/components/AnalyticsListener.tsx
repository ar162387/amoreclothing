import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

/**
 * Sends a GA4 page_view on every client-side route change (the initial config sets
 * send_page_view: false, and /admin + /login are filtered inside trackPageView). Renders nothing.
 */
export default function AnalyticsListener() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    trackPageView(pathname + search);
  }, [pathname, search]);

  return null;
}
