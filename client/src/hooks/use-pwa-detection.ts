import { useState, useEffect } from 'react';

export interface PWAStatus {
  isPWA: boolean;
  isIOSDevice: boolean;
  canInstall: boolean;
  installPrompt?: BeforeInstallPromptEvent;
  displayMode: string;
}

export function usePWADetection(): PWAStatus {
  const [pwaStatus, setPWAStatus] = useState<PWAStatus>({
    isPWA: false,
    isIOSDevice: false,
    canInstall: false,
    displayMode: 'browser'
  });

  useEffect(() => {
    const detectPWAStatus = () => {
      // Check if running in standalone mode (PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;
      
      // Detect iOS devices
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Get display mode
      const displayMode = isStandalone ? 'standalone' : 
                         window.matchMedia('(display-mode: fullscreen)').matches ? 'fullscreen' :
                         window.matchMedia('(display-mode: minimal-ui)').matches ? 'minimal-ui' : 'browser';

      // Determine if user can install
      const canInstall = !isStandalone && (isIOSDevice || 'serviceWorker' in navigator);

      setPWAStatus({
        isPWA: isStandalone,
        isIOSDevice,
        canInstall,
        displayMode
      });

      console.log('[PWA Detection]', {
        isPWA: isStandalone,
        isIOSDevice,
        canInstall,
        displayMode,
        userAgent: navigator.userAgent
      });
    };

    detectPWAStatus();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addListener(detectPWAStatus);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setPWAStatus(prev => ({
        ...prev,
        installPrompt: e,
        canInstall: true
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    return () => {
      mediaQuery.removeListener(detectPWAStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  return pwaStatus;
}

// Extended BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}