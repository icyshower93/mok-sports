import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { registerRoutes } from "./routes";

// ESM __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment check
const isDev = process.env.NODE_ENV !== 'production';

// Backend build info for debugging
const SERVER_BUILD_INFO = {
  version: Date.now(),
  date: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
  hash: Date.now().toString(36),
  note: isDev ? 'Running in development mode' : 'Running in production mode'
};

console.log('🚀 [Server] Build Info:', SERVER_BUILD_INFO);
console.log('📝 [Server] Environment Note: NODE_ENV=development means we have dev debugging enabled while serving production builds');

async function setupProductionAssets(app: express.Application): Promise<string> {
  // Single source of truth for build output
  const clientDist = path.resolve(__dirname, '../dist/public');
  
  console.log('[server] NODE_ENV:', process.env.NODE_ENV);
  console.log('[server] __dirname:', __dirname);
  console.log('[server] selected clientDist:', clientDist);

  if (!fs.existsSync(path.join(clientDist, 'index.html'))) {
    console.error('[server] Missing build at', clientDist);
    process.exit(1);
  }

  // Service worker with no-cache
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(clientDist, 'sw.js'));
  });

  // Cache control middleware
  app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.headers.accept?.includes('text/html')) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (/\.(?:js|css|woff2?)$/.test(req.path)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
  });

  // Serve static assets (don't auto-serve index so SPA fallback can handle all routes)
  app.use(express.static(clientDist, { index: false }));
  console.log('[server] Static assets configured from:', clientDist);
  return clientDist;
}

const app = express();

// Configure CORS for PWA and cross-origin requests
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost and development domains
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('.replit.dev') ||
        origin.includes('.replit.app')) {
      return callback(null, true);
    }
    
    // Allow the specific deployment domain
    if (origin === 'https://mok-sports-draft-mokfantasysport.replit.app') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cookie']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize VAPID keys on startup
  const { storage } = await import("./storage");
  try {
    const vapidKeys = storage.getVapidKeys();
  } catch (error) {
  }

  // CRITICAL: Configure static asset serving BEFORE any other routes
  const clientDist = await setupProductionAssets(app);
  const hasBuiltAssets = Boolean(clientDist);

  // Add middleware to prevent caching of development files
  app.use('/src', (req, res, next) => {
    console.log('[Server] BLOCKING development file request:', req.path);
    res.status(404).json({ error: 'Development files not available in production' });
  });

  // Add emergency cache fix route BEFORE other routes
  app.get('/emergency', (req, res) => {
    console.log('[Emergency] Cache fix page requested');
    const emergencyPath = path.resolve(__dirname, "..", "emergency-cache-fix.html");
    res.sendFile(emergencyPath);
  });

  // Add force refresh route for cache bypass
  app.get('/force-refresh', (req, res) => {
    console.log('[Force Refresh] Cache bypass page requested');
    const refreshPath = path.resolve(__dirname, "..", "force-refresh.html");
    res.sendFile(refreshPath);
  });

  // Add legacy emergency route BEFORE other routes  
  app.get('/emergency-old', (req, res) => {
    console.log('[Emergency] Cache break page requested');
    const emergencyHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Emergency Cache Break - Mok Sports</title>
    <style>
        body {
            background: #0f172a;
            color: white;
            font-family: system-ui;
            text-align: center;
            padding: 50px 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        h1 { color: #10b981; }
        .button {
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .button:hover {
            background: #059669;
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 8px;
            background: #1e293b;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚨 Emergency Cache Recovery</h1>
        <p>Your browser has extreme cache corruption. We need to manually break the cache cycle.</p>
        
        <div class="status" id="status">
            Ready to clear all caches and force fresh load
        </div>
        
        <button class="button" onclick="emergencyReset()">
            🗑️ Emergency Cache Clear + Reload
        </button>
        
        <button class="button" onclick="manualReset()">
            🔄 Manual Hard Refresh
        </button>
        
        <button class="button" onclick="checkStatus()">
            📊 Check Cache Status
        </button>
    </div>

    <script>
        console.log('[Emergency] Cache break page loaded');
        
        async function emergencyReset() {
            const status = document.getElementById('status');
            
            try {
                status.innerHTML = 'Step 1: Unregistering all service workers...';
                
                // Unregister ALL service workers
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    console.log('[Emergency] Found', registrations.length, 'service workers');
                    for (let registration of registrations) {
                        await registration.unregister();
                        console.log('[Emergency] Unregistered service worker');
                    }
                }
                
                status.innerHTML = 'Step 2: Clearing all browser caches...';
                
                // Clear all caches
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    console.log('[Emergency] Found', cacheNames.length, 'caches');
                    for (let cacheName of cacheNames) {
                        await caches.delete(cacheName);
                        console.log('[Emergency] Deleted cache:', cacheName);
                    }
                }
                
                status.innerHTML = 'Step 3: Clearing local storage...';
                
                // Clear all storage
                localStorage.clear();
                sessionStorage.clear();
                
                status.innerHTML = 'Step 4: Force refreshing to main app...';
                
                // Navigate to main app with extreme cache busting
                const url = new URL(window.location.origin);
                url.searchParams.set('emergency-reset', Date.now());
                url.searchParams.set('cache-break', Math.random().toString(36));
                url.searchParams.set('force-refresh', 'true');
                
                setTimeout(() => {
                    window.location.href = url.toString();
                }, 1000);
                
            } catch (error) {
                status.innerHTML = '❌ Error: ' + error.message;
                console.error('[Emergency] Reset failed:', error);
            }
        }
        
        function manualReset() {
            alert('Please manually:\\n1. Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)\\n2. If that fails, open DevTools > Application > Storage > Clear site data');
        }
        
        async function checkStatus() {
            const status = document.getElementById('status');
            let report = [];
            
            // Check service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                report.push(\`Service Workers: \${registrations.length}\`);
                registrations.forEach(reg => {
                    report.push(\`- \${reg.scope}: \${reg.active?.scriptURL || 'inactive'}\`);
                });
            }
            
            // Check caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                report.push(\`Browser Caches: \${cacheNames.length}\`);
                cacheNames.forEach(name => {
                    report.push(\`- \${name}\`);
                });
            }
            
            status.innerHTML = '<pre>' + report.join('\\\\n') + '</pre>';
        }
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(emergencyHTML);
  });

  // Import and register scoring routes
  const { scoringRouter } = await import("./routes/scoring.js");
  app.use("/api/scoring", scoringRouter);
  console.log("📊 Scoring routes registered successfully");
  
  const server = await registerRoutes(app);
  
  // Initialize Redis and recover active timers after server restart
  try {
    const { createRedisClient } = await import("./redis");
    const redis = createRedisClient();
    console.log('[Redis] Client initialized');
    
    const { default: SnakeDraftManager } = await import("./draft/snakeDraftManager");
    const draftManager = new SnakeDraftManager(storage);
    await draftManager.recoverActiveTimers();
  } catch (error) {
    console.error('Failed to initialize Redis or recover timers on startup:', error);
  }

  // Set up Vite or static serving based on environment
  if (isDev) {
    // Only use Vite middleware if we don't have built assets
    if (!hasBuiltAssets) {
      // Conditional dynamic import for Vite in development only
      const { setupVite } = await import("./vite.js");
      await setupVite(app, server);
    } else {
      console.log('[Server] Using built assets, skipping Vite middleware');
    }
  }
  
  // SPA fallback (reuse the exact same dist path)
  if (hasBuiltAssets && clientDist) {
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/') ||
          req.path.startsWith('/draft-ws') ||
          req.path.startsWith('/ws/') ||
          req.path.startsWith('/admin-ws')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Health endpoint for Replit deployment detection
  app.get('/healthz', (_req, res) => res.status(200).send('ok'));

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3000 for production compatibility.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';
  
  server.listen(PORT, HOST, () => {
    console.log(`[server] listening on http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);
  });
})();
