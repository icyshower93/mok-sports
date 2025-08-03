import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function DesktopQR() {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const appUrl = 'https://mok-sports-draft-mokfantasysport.replit.app';

  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(appUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#1f2937',
            light: '#ffffff'
          }
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, [appUrl]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #10b981, #3b82f6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '16px',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ marginBottom: '8px', color: '#1f2937', fontSize: '28px', fontWeight: 'bold' }}>Mok Sports</h1>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>Fantasy Sports Reimagined</p>
        </div>
        
        <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
          <h3 style={{ marginBottom: '12px', color: '#1f2937', fontSize: '18px' }}>Scan with Your Mobile Device</h3>
          <p style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
            Open this app on your mobile device for the best experience and push notifications:
          </p>
          
          {qrCodeDataUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <img 
                src={qrCodeDataUrl} 
                alt="QR Code to open Mok Sports on mobile" 
                style={{ 
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white'
                }}
              />
            </div>
          )}
          
          <div style={{ marginBottom: '16px', color: '#6b7280', fontSize: '12px' }}>
            <code style={{ 
              backgroundColor: '#e5e7eb', 
              padding: '4px 8px', 
              borderRadius: '4px',
              color: '#374151'
            }}>
              {appUrl}
            </code>
          </div>
          
          <div style={{ textAlign: 'left', color: '#6b7280', fontSize: '14px' }}>
            <p>1. <strong>Scan this QR code</strong> with your phone camera</p>
            <p>2. <strong>Add to Home Screen</strong> when prompted</p>
            <p>3. <strong>Open from home screen</strong> for PWA mode</p>
          </div>
        </div>
        
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📱📸</div>
        <p style={{ color: '#6b7280', fontSize: '12px' }}>
          Best experienced as a Progressive Web App on mobile devices!
        </p>
      </div>
    </div>
  );
}