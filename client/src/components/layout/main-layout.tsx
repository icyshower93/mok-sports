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
      "min-h-screen bg-gradient-to-b from-background to-muted/30 transition-opacity duration-500",
      isVisible ? "opacity-100" : "opacity-0",
      className
    )}>
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}