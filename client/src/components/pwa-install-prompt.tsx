import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePWADetection } from '@/hooks/use-pwa-detection';

export function PWAInstallPrompt() {
  const { isPWA, isIOSDevice, canInstall, installPrompt } = usePWADetection();

  // Don't show if already in PWA mode
  if (isPWA) {
    return null;
  }

  // Don't show if can't install
  if (!canInstall) {
    return null;
  }

  const handleInstallClick = async () => {
    if (installPrompt) {
      // Android/Chrome install
      try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
      } catch (error) {
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center text-3xl">
            🏈
          </div>
          <CardTitle className="text-2xl">Install Mok Sports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            Get the best experience with push notifications and offline access.
          </p>

          {isIOSDevice ? (
            // iOS installation instructions
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-center mb-3">iOS Installation</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div>
                    <div className="font-medium">Tap the Share button</div>
                    <div className="text-gray-600">Look for 📤 in Safari's toolbar</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div>
                    <div className="font-medium">Select "Add to Home Screen"</div>
                    <div className="text-gray-600">Scroll down in the share menu</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div>
                    <div className="font-medium">Tap "Add"</div>
                    <div className="text-gray-600">Then open from your home screen</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Android/Chrome installation */}
              <div className="space-y-3">
              {installPrompt ? (
                <Button 
                  onClick={handleInstallClick}
                  className="w-full bg-gradient-to-r from-emerald-500 to-blue-600"
                >
                  Install App
                </Button>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center text-sm">
                  <p className="font-medium mb-2">Browser Installation</p>
                  <p className="text-gray-600">
                    Look for an "Install" icon in your browser's address bar, 
                    or check your browser menu for "Install Mok Sports" option.
                  </p>
                </div>
              )}
              </div>
            </>
          )}

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Installing enables push notifications and offline access
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}