import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Check for module loading errors
    if (error.message.includes('MIME type') || 
        error.message.includes('module script') ||
        error.message.includes('Failed to fetch')) {
      console.error('Module loading error detected - clearing caches');
      this.clearCachesAndReload();
    }
  }

  clearCachesAndReload = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches cleared');
      }

      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
        console.log('Service workers unregistered');
      }

      // Reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error clearing caches:', error);
      // Force reload anyway
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isModuleError = this.state.error?.message.includes('MIME type') ||
                           this.state.error?.message.includes('module script') ||
                           this.state.error?.message.includes('Failed to fetch');

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center text-3xl">
                ⚠️
              </div>
              <CardTitle className="text-2xl">
                {isModuleError ? 'Loading Error' : 'Something went wrong'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-gray-600">
                {isModuleError 
                  ? 'The app failed to load properly. This usually happens after an update.'
                  : 'An unexpected error occurred in the application.'
                }
              </p>
              
              {isModuleError && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>Auto-fixing:</strong> Clearing old cached files and reloading...
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Button 
                  onClick={this.clearCachesAndReload}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  Clear Cache & Reload
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="w-full"
                >
                  Simple Reload
                </Button>
              </div>

              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4">
                  <summary className="text-sm text-gray-500 cursor-pointer">
                    Technical Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
                    <div className="text-red-600 mb-2">
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    <div className="text-gray-600">
                      {this.state.error.stack}
                    </div>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}