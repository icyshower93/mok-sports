import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { clearCachesAndReload } from '@/utils/cache-utils';

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Add a small delay for smooth entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-b from-background to-muted/30 transition-opacity duration-500",
      isVisible ? "opacity-100" : "opacity-0",
      className
    )}>
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
      
      {/* Debug Panel for Development */}
      {import.meta.env.VITE_ENABLE_DEBUG_UI === 'true' && (
        <div className="fixed top-4 right-4 bg-red-500/90 text-white p-2 rounded text-xs z-50">
          <div>Debug Mode</div>
          <div>Build: {import.meta.env.VITE_BUILD_HASH || 'dev'}</div>
          <button 
            onClick={clearCachesAndReload}
            className="mt-1 px-1 py-0.5 bg-white/20 rounded hover:bg-white/30"
          >
            Clear Cache
          </button>
        </div>
      )}
    </div>
  );
}