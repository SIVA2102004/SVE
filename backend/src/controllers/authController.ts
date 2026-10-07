import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { broadcastEvent } from '../websocket/socket.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shopflow_fallback_jwt_secret_2026';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'shopflow_refresh_token_secret_2026';

const loginSchema = z.object({
  identifier: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.identifier || data.username, {
  message: 'Username or Email is required',
  path: ['identifier'],
});

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const identifier = (parsed.identifier || parsed.username)!;
    const password = parsed.password;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account has been deactivated. Contact owner.' });
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      return res.status(429).json({
        success: false,
        message: `Account is temporarily locked due to repeated failed logins. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      const newAttempts = user.failedAttempts + 1;
      let lockedUntil: Date | null = null;
      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: newAttempts, lockedUntil },
      });

      return res.status(401).json({
        success: false,
        message: newAttempts >= 5
          ? 'Too many failed attempts. Account locked for 15 minutes.'
          : `Invalid credentials. (${5 - newAttempts} attempts remaining before temporary lockout)`,
      });
    }

    // Reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // Generate Tokens
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign({ id: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    // Store Session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token,
        refreshToken,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Set secure HTTP-only cookies
    res.cookie('shopflow_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.cookie('shopflow_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: req.ip || null,
        details: JSON.stringify({ userAgent: req.headers['user-agent'] }),
      },
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Login failed' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const token = req.token;
    if (token) {
      await prisma.session.updateMany({
        where: { token },
        data: { revokedAt: new Date() },
      });
    }

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'LOGOUT',
          entityType: 'USER',
          entityId: req.user.id,
          ipAddress: req.ip || null,
        },
      });
    }

    res.clearCookie('shopflow_token');
    res.clearCookie('shopflow_refresh');

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logoutAllDevices = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.clearCookie('shopflow_token');
    res.clearCookie('shopflow_refresh');

    res.json({ success: true, message: 'Logged out from all devices successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const settings = await prisma.shopSettings.findFirst();

    res.json({
      success: true,
      user,
      settings: settings || {
        shopName: 'ShopFlow Store',
        currency: 'INR',
        currencySymbol: '₹',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
