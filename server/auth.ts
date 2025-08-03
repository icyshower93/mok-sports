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
  // Use the deployment domain if we're in production (when REPLIT_DOMAINS contains a .replit.dev domain)
  const replitDomains = process.env.REPLIT_DOMAINS;
  
  // Check if we're in a deployed Replit environment
  if (replitDomains && replitDomains.includes('.replit.dev')) {
    // This is the production deployment domain pattern for this project
    return 'https://mok-sports-draft-mokfantasysport.replit.app';
  }
  
  // Development environment with REPLIT_DOMAINS
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
  const token = req.cookies?.auth_token;
  
  if (!token) {
    return res.status(401).json({ 
      message: "Not authenticated",
      reason: "no_token",
      debug: {
        cookiesReceived: Object.keys(req.cookies || {}),
        origin: req.headers.origin
      }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie("auth_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
      domain: process.env.NODE_ENV === "production" ? ".replit.app" : undefined
    });
    return res.status(401).json({ 
      message: "Invalid token",
      reason: "invalid_token",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Export OAuth configuration status
export { isOAuthConfigured };
