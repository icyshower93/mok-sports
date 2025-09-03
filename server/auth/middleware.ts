import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../auth.js';

export async function requireAuthCookieOrToken(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;
    
    // Try token first (Authorization header)
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice("Bearer ".length).trim();
      console.log("[Auth] Found token in Authorization header");
    }
    
    // Fallback to cookie/session - check both auth_token and token
    if (!token && req.cookies?.auth_token) {
      token = req.cookies.auth_token;
      console.log("[Auth] Found token in auth_token cookie");
    }
    
    // Also check for 'token' cookie as fallback (for compatibility)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
      console.log("[Auth] Found token in token cookie");
    }
    
    if (!token) {
      console.log("[Auth] No token found in header or cookies");
      console.log("[Auth] Available cookies:", Object.keys(req.cookies || {}));
      console.log("[Auth] Authorization header:", req.headers.authorization);
      
      // Development fallback - same logic as getAuthenticatedUser
      if (process.env.NODE_ENV === 'development') {
        console.log("[Auth] Using development fallback authentication");
        (req as any).user = {
          id: '9932fcd8-7fbb-49c3-8fbb-f254cff1bb9a',
          email: 'sky@mokfantasysports.com',
          name: 'Sky Evans'
        };
        return next();
      }
      
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Verify the token
    const userFromToken = verifyJWT(token);
    if (userFromToken && typeof userFromToken !== 'string') {
      (req as any).user = userFromToken;
      console.log("[Auth] User authenticated via token:", userFromToken.name);
      return next();
    }

    return res.status(401).json({ message: "Invalid token" });
  } catch (e) {
    console.error("[Auth] Authentication error:", e);
    return res.status(401).json({ message: "Authentication failed" });
  }
}