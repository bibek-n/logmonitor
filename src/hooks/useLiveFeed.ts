"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseLiveFeedResult<T> {
  items: T[];
  loading: boolean;
  error: boolean;
}

// Shared client-side fetching for the marketing home page's news/knowledge widgets: fetches
// on mount, on a recurring interval, and again whenever the tab regains visibility or focus
// (a backgrounded tab's interval gets throttled by the browser, the same issue documented in
// IdleLogout.tsx — visibilitychange/focus catch it the moment the user comes back). An
// in-flight guard skips a call if the previous one hasn't finished, so a focus event firing
// right as the interval also fires can't launch two overlapping requests. A failed fetch
// keeps whatever was already on screen rather than blanking the widget.
export function useLiveFeed<T>(url: string, intervalMs: number): UseLiveFeedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!mountedRef.current) return;
      if (data.ok && Array.isArray(data.items)) {
        setItems(data.items);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      if (mountedRef.current) setError(true);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const interval = setInterval(load, intervalMs);

    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [load, intervalMs]);

  return { items, loading, error };
}
