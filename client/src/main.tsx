import { trace } from "@/debug/trace";
trace("main.tsx");
import { createRoot } from "react-dom/client";
import { StrictMode, Suspense } from "react";
import "@/index.css";

(async () => {
  const { default: App } = await import("@/App");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Suspense fallback={<div className="p-6 text-sm opacity-70">Loading…</div>}>
        <App />
      </Suspense>
    </StrictMode>
  );
})();

// --- iOS swipe/back-gesture prevention (safe: no TDZ) ---
(function setupIOSSwipePrevention() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!isIOS) return;

  let touching = false;
  let startX = 0;

  // passive:true for start/end; passive:false for move because we may preventDefault
  window.addEventListener(
    "touchstart",
    (e) => {
      touching = true;
      startX = e.touches[0]?.clientX ?? 0;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!touching) return;
      const dx = (e.touches[0]?.clientX ?? 0) - startX;
      // prevent right-edge back-swipe; tune threshold if needed
      if (dx > 30 && e.touches[0]?.clientX < 20) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  window.addEventListener(
    "touchend",
    () => {
      touching = false;
    },
    { passive: true }
  );
})();
