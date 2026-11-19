"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// A thin top-of-page bar that animates while a dashboard navigation is in flight, the same
// "it's working" cue GitHub/YouTube use — Next.js's App Router doesn't expose router
// start/end events, so this infers "navigation started" from any internal link click and
// infers "navigation finished" from the pathname actually changing, rather than adding a
// router-events dependency for one small visual.
export default function RouteProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      if (anchor.origin !== window.location.origin) return;
      if (href === window.location.pathname + window.location.search) return;

      if (finishTimer.current) clearTimeout(finishTimer.current);
      setVisible(true);
      setProgress(0);
      // Rush to ~80% quickly, then stall there — real completion (pathname change) takes it
      // the rest of the way, so the bar never looks "done" before the page actually is.
      requestAnimationFrame(() => setProgress(80));
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setProgress(100);
    finishTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
    return () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed left-0 top-0 z-[400]"
          style={{ height: 3, background: "var(--primary)", boxShadow: "0 0 8px var(--primary)" }}
          initial={{ width: "0%", opacity: 1 }}
          animate={{ width: `${progress}%`, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: progress === 100 ? 0.2 : 0.5, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}
