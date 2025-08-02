import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "mok-sports-jwt-secret-fallback-key-12345";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "1077639609469-v38s9pusppugugaik52bcqpc3f3pdp65.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "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";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("⚠️  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables");
}

// Get the base URL for redirects
const getBaseUrl = () => {
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const domains = replitDomains.split(',');
    return `https://${domains[0]}`;
  }
  return process.env.NODE_ENV === 'production' 
    ? 'https://your-app-domain.com' 
    : 'http://localhost:5000';
};

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: `${getBaseUrl()}/api/auth/google/callback`,
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
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  const user = verifyJWT(token);
  if (!user) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }

  req.user = user;
  next();
}
