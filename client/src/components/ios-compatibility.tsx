import { useEffect, useState } from 'react';

export function IOSCompatibilityCheck() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const errorList: string[] = [];

    // Check for iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Check for common iOS compatibility issues
      if (!window.CSS?.supports) {
        errorList.push('CSS.supports not available');
      }
      
      if (!window.fetch) {
        errorList.push('Fetch API not available');
      }
      
      if (!window.Promise) {
        errorList.push('Promise not available');
      }
      
      if (!window.localStorage) {
        errorList.push('localStorage not available');
      }
      
      // Check viewport meta tag
      const viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        errorList.push('Missing viewport meta tag');
      }
    }

    setErrors(errorList);
    
    if (errorList.length > 0) {
      console.error('[iOS Compatibility] Issues detected:', errorList);
    }
  }, []);

  if (errors.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ef4444',
      color: 'white',
      padding: '8px',
      fontSize: '12px',
      zIndex: 9999
    }}>
      <strong>iOS Compatibility Issues:</strong> {errors.join(', ')}
    </div>
  );
}