import { createRoot } from "react-dom/client";
// TEMP: Test minimal version
import "@/test-minimal";

// Enhanced iOS swipe prevention
if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
  // Prevent edge swipe navigation on iOS
  let startX = 0;
  let startY = 0;
  
  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: false });
  
  document.addEventListener('touchmove', (e) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;
    
    // Prevent horizontal swipes from edge
    if (Math.abs(diffX) > Math.abs(diffY) && (startX < 20 || startX > window.innerWidth - 20)) {
      e.preventDefault();
    }
  }, { passive: false });
}

// Service worker is now handled by the useServiceWorker hook in PWA mode only

createRoot(document.getElementById("root")!).render(<App />);
// Build marker: Sat Aug 30 07:42:21 PM UTC 2025
