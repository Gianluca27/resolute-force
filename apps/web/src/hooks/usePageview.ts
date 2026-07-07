import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/** Records a pageview on every public route change. Admin routes are excluded so internal
 *  traffic never pollutes the store's visit/conversion metrics. The ref guards against
 *  StrictMode's dev double-invoke and repeated fires for the same path. */
export function usePageview(): void {
  const last = useRef<string | null>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    if (last.current === pathname) return;
    last.current = pathname;
    fetch(`${BASE}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);
}

/** Mount once inside the router to enable pageview tracking. Renders nothing. */
export function RouteTracker(): null {
  usePageview();
  return null;
}
