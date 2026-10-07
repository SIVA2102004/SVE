import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shopflow_fallback_jwt_secret_2026';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.shopflow_token) {
    // 2. Check HTTP-only secure cookie
    token = req.cookies.shopflow_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication token missing.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;

    // Verify session in DB to support instant revocation/logout
    const session = await prisma.session.findFirst({
      where: {
        token,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user || !session.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Session has expired or was revoked. Please log in again.',
      });
    }

    req.user = {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as any,
    };
    req.token = token;

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
}

/**
 * Strict role-based permission guard
 */
export function requireRoles(...allowedRoles: ('OWNER' | 'MANAGER' | 'STAFF')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' lacks permission for this action.`,
      });
    }

    next();
  };
}
