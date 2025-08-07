import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

async function setupProductionAssets(app: express.Application) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  
  if (fs.existsSync(distPath)) {
    console.log('[Server] Serving built assets from:', distPath);
    
    // Critical: Serve /assets/* files with correct MIME types FIRST
    app.use('/assets', (req, res, next) => {
      console.log('[Assets] Serving asset:', req.path);
      next();
    }, express.static(path.join(distPath, 'assets'), {
      maxAge: '1y', // Cache assets for 1 year
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        console.log('[Assets] Setting headers for:', filePath);
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          console.log('[Assets] JS file served with no-cache headers to force browser refresh');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          console.log('[Assets] CSS file served with correct MIME type');
        } else if (filePath.endsWith('.woff2') || filePath.endsWith('.woff')) {
          res.setHeader('Content-Type', 'font/woff2');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    
    // Serve manifest.json, service worker, and other root files
    app.use(express.static(distPath, {
      index: false, // Don't serve index.html automatically
      maxAge: '1d', // Cache for 1 day
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('manifest.json')) {
          res.setHeader('Content-Type', 'application/manifest+json');
        } else if (filePath.endsWith('sw.js') || filePath.endsWith('service-worker.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache'); // Don't cache service worker
        }
      }
    }));
    
    console.log('[Server] Static file serving configured for PWA');
    return true;
  } else {
    console.log('[Server] No built assets found at:', distPath);
    return false;
  }
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

      log(logLine);
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
  const hasBuiltAssets = await setupProductionAssets(app);

  // Add middleware to prevent caching of development files
  app.use('/src', (req, res, next) => {
    console.log('[Server] BLOCKING development file request:', req.path);
    res.status(404).json({ error: 'Development files not available in production' });
  });

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
  if (app.get("env") === "development") {
    // Only use Vite middleware if we don't have built assets
    // This prevents Vite from intercepting asset requests
    if (!hasBuiltAssets) {
      await setupVite(app, server);
    } else {
      console.log('[Server] Using built assets, skipping Vite middleware');
      // Add catch-all for SPA routing (only for non-asset routes)
      app.get('*', (req, res, next) => {
        // Don't intercept API routes
        if (req.path.startsWith('/api/')) {
          return next();
        }
        
        // Don't intercept asset requests or static files
        if (req.path.startsWith('/assets/') || 
            req.path.endsWith('.js') || 
            req.path.endsWith('.css') ||
            req.path.endsWith('.json') ||
            req.path.endsWith('.ico') ||
            req.path.endsWith('.png') ||
            req.path.endsWith('.svg') ||
            req.path.endsWith('.woff2') ||
            req.path.endsWith('.manifest') ||
            req.path === '/sw.js' ||
            req.path === '/manifest.json') {
          return next();
        }
        
        // Serve the built index.html for all SPA routes
        const indexPath = path.resolve(import.meta.dirname, "..", "dist", "public", "index.html");
        res.sendFile(indexPath);
      });
    }
  } else {
    serveStatic(app);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
