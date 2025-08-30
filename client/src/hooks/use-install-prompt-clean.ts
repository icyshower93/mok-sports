import { useEffect, useState, useCallback } from "react";

type BIPEvent = Event & { 
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>; 
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    // Debug flag to skip install prompt
    if (new URLSearchParams(location.search).has('nopwa')) {
      console.log('[Install] Skipped due to ?nopwa parameter');
      return;
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      console.log('[Install] Install prompt available');
    };

    window.addEventListener('beforeinstallprompt', onBIP);
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const showPrompt = useCallback(async () => {
    if (!deferred) return null;
    
    try {
      const res = await deferred.prompt();
      setDeferred(null);
      console.log('[Install] Prompt result:', res);
      return res;
    } catch (error) {
      console.error('[Install] Prompt error:', error);
      return null;
    }
  }, [deferred]);

  return { 
    canInstall: !!deferred, 
    showPrompt 
  };
}