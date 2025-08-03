import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
      "min-h-screen bg-gradient-to-br from-background via-background to-muted/20 transition-opacity duration-700 ease-out",
      isVisible ? "opacity-100" : "opacity-0",
      className
    )}>
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--fantasy-success)_0%,_transparent_50%)] opacity-5" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--fantasy-accent)_0%,_transparent_50%)] opacity-5" />
      
      {/* Main content */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {children}
        </div>
      </div>
    </div>
  );
}