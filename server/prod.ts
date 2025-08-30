import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { registerRoutes } from "./routes";

// ESM __dirname setup for production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment check
const isDev = process.env.NODE_ENV !== 'production';

// Backend build info for debugging
const SERVER_BUILD_INFO = {
  version: Date.now(),
  date: new Date().toISOString(),
  env: process.env.NODE_ENV || 'production',
  hash: Date.now().toString(36),
  note: 'Production server'
};

console.log('🚀 [Server] Build Info:', SERVER_BUILD_INFO);

async function setupProductionAssets(app: express.Application) {
  // In production after build, client dist should be at ../../client/dist relative to compiled server
  const clientDist = process.env.CLIENT_DIST ?? path.resolve(__dirname, '../../client/dist');
  
  if (fs.existsSync(clientDist)) {
    console.log('[Server] Serving built client assets from:', clientDist);
    
    // Serve static assets with correct headers
    app.use(express.static(clientDist, { 
      maxAge: '1h', 
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
      }
    }));
    
    // SPA fallback for client-side routing
    app.get('*', (req, res, next) => {
      // Don't intercept API routes or WebSocket paths
      if (req.path.startsWith('/api/') || 
          req.path.startsWith('/draft-ws') || 
          req.path.startsWith('/ws/') ||
          req.path.startsWith('/admin-ws')) {
        return next();
      }
      
      // Don't intercept static asset requests
      if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/i)) {
        return next();
      }
      
      // Serve index.html for SPA routes
      res.sendFile(path.join(clientDist, 'index.html'));
    });
    
    return true;
  } else {
    console.error('[Server] Client build not found at:', clientDist);
    console.error('[Server] Make sure to run the client build first');
    return false;
  }
}

const app = express();

// Configure CORS for production
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Allow production domains
    if (origin.includes('.replit.app') || 
        origin.includes('.replit.dev') ||
        origin.includes('localhost')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cookie']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Request logging for API routes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  
  next();
});

(async () => {
  // Initialize VAPID keys on startup
  const { storage } = await import("./storage");
  
  // Configure static asset serving
  const hasBuiltAssets = await setupProductionAssets(app);
  
  if (!hasBuiltAssets) {
    console.error('[Server] FATAL: No client assets found. Cannot start production server.');
    process.exit(1);
  }
  
  // Register API routes
  const server = await registerRoutes(app);
  
  // Initialize Redis and recover active timers
  try {
    const { createRedisClient } = await import("./redis");
    const redis = createRedisClient();
    console.log('[Redis] Client initialized');
    
    const { default: SnakeDraftManager } = await import("./draft/snakeDraftManager");
    const draftManager = new SnakeDraftManager(storage);
    await draftManager.recoverActiveTimers();
  } catch (error) {
    console.error('Failed to initialize Redis or recover timers:', error);
  }

  // Error handling
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    if (isDev) {
      console.error('[Server Error]:', err);
    }
    
    res.status(status).json({ message });
  });

  // Health endpoint for Replit deployment detection
  app.get('/healthz', (_req, res) => res.status(200).send('ok'));

  // Production server configuration
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';
  
  server.listen(PORT, HOST, () => {
    console.log(`[server] listening on http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'production'})`);
  });
})();

export default app;