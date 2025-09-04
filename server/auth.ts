import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "mok-sports-jwt-secret-fallback-key-12345";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Gracefully handle missing OAuth credentials
let isOAuthConfigured = false;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
} else {
  isOAuthConfigured = true;
}

// Get the base URL for redirects
const getBaseUrl = () => {
  // Development environment - use stable REPLIT_DEV_DOMAIN
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Production deployment - use REPLIT_DOMAINS environment variable
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const domains = replitDomains.split(',');
    return `https://${domains[0]}`;
  }
  
  // Final fallback for local development
  return 'http://localhost:5000';
};

// Only configure Google OAuth strategy if credentials are available
if (isOAuthConfigured && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  const callbackURL = `${getBaseUrl()}/api/auth/google/callback`;
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const avatar = profile.photos?.[0]?.value;

          if (!email) {
            return done(new Error("No email found in Google profile"), undefined);
          }

          // Check if user already exists
          let user = await storage.getUserByGoogleId(googleId);
          
          if (!user) {
            // Check if user exists with same email but different Google ID
            const existingUser = await storage.getUserByEmail(email);
            if (existingUser) {
              return done(new Error("An account with this email already exists"), undefined);
            }

            // Create new user
            user = await storage.createUser({
              googleId,
              email,
              name,
              avatar,
            });
          } else {
            // Update last login
            await storage.updateLastLogin(user.id);
          }

          return done(null, user);
        } catch (error) {
          return done(error, undefined);
        }
      }
    )
  );
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export function generateJWT(user: any) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      avatar: user.avatar 
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyJWT(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  console.log('[Auth] Authenticating request');
  
  // Try to get token from different sources
  let token: string | undefined;
  
  // 1. Check Authorization header (Bearer token) - preferred for PWA
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('[Auth] Token found in Authorization header');
  }
  
  // 2. Fallback to cookie if no Bearer token (for browser requests)
  if (!token && req.cookies?.auth_token) {
    token = req.cookies.auth_token;
    console.log('[Auth] Token found in cookie');
  }
  
  if (!token) {
    console.log('[Auth] No token found');
    console.log('[Auth] Available cookies:', Object.keys(req.cookies || {}));
    console.log('[Auth] Authorization header:', req.headers.authorization);
    
    // RESTRICTED: Only use development fallback for very specific test endpoints
    if (process.env.NODE_ENV === "development" && req.path.includes('/api/debug/test-only')) {
      console.log('[Auth] Development mode DEBUG endpoint - returning test user (not Sky Evans)');
      (req as any).user = {
        id: "debug-test-user-12345",
        name: "Debug Test User",
        email: "debug@test-only.local"
      };
      return next();
    }
    
    return res.status(401).json({ 
      message: "Authentication required",
      error: "missing_token",
      hint: "Include Authorization: Bearer <token> header or login via /api/auth/google"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    console.log('[Auth] Token verified successfully for user:', decoded.email);
    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        message: "Token expired", 
        error: "token_expired",
        hint: "Please login again via /api/auth/google"
      });
    }
    
    return res.status(401).json({ 
      message: "Invalid token", 
      error: "invalid_token",
      hint: "Please login again via /api/auth/google"
    });
  }
}

// Export OAuth configuration status
export { isOAuthConfigured };
