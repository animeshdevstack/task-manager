import type { RequestHandler } from "express";
import { verifyToken } from "../helper/jwt.helper";

export interface AuthPayload {
  id?: string;
  email?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

const authMiddleware: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: missing or invalid Authorization header",
    });
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: missing token",
    });
    return;
  }

  try {
    const payload = verifyToken(token) as AuthPayload;
    if (!payload?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: invalid token payload",
      });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or expired token",
    });
  }
};

const requireRoles = (...roles: string[]): RequestHandler => {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({
        success: false,
        message: "Forbidden: insufficient permissions",
      });
      return;
    }
    next();
  };
};

export { authMiddleware, requireRoles };
