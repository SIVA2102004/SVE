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
        shopName: 'SVE Store',
        currency: 'INR',
        currencySymbol: '₹',
        accessCode: 'SVE-2026',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']).default('STAFF'),
  companyName: z.string().optional(),
  accessCode: z.string().optional(),
});

export const register = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if any user exists in the database
    const userCount = await prisma.user.count();
    let shopSettings = await prisma.shopSettings.findFirst();

    let targetRole = data.role;

    // If no users exist, the very first registrant is automatically the OWNER
    if (userCount === 0) {
      targetRole = 'OWNER';
      // If companyName was provided, initialize/update shop settings
      const newAccessCode = data.accessCode?.trim() || 'SVE-2026';
      if (!shopSettings) {
        shopSettings = await prisma.shopSettings.create({
          data: {
            shopName: data.companyName?.trim() || 'SVE Store',
            accessCode: newAccessCode,
            email: data.email.toLowerCase(),
            phone: data.phone || null,
          },
        });
      } else {
        shopSettings = await prisma.shopSettings.update({
          where: { id: shopSettings.id },
          data: {
            shopName: data.companyName?.trim() || shopSettings.shopName,
            accessCode: newAccessCode,
          },
        });
      }
    } else {
      // Users already exist.
      // If registering as OWNER or specifying a new access code, check if an owner already exists
      const existingOwner = await prisma.user.findFirst({ where: { role: 'OWNER' } });

      if (targetRole === 'OWNER') {
        if (existingOwner) {
          // If an owner already exists, require the current company accessCode to confirm owner-level authorization
          const currentCode = shopSettings?.accessCode || 'SVE-2026';
          if (!data.accessCode || data.accessCode.trim() !== currentCode) {
            return res.status(403).json({
              success: false,
              message: 'Invalid Company Access Code. An Owner is already registered for this shop.',
            });
          }
        } else {
          // No owner currently exists, allow becoming owner
          if (data.companyName) {
            if (shopSettings) {
              await prisma.shopSettings.update({
                where: { id: shopSettings.id },
                data: {
                  shopName: data.companyName.trim(),
                  accessCode: data.accessCode?.trim() || shopSettings.accessCode,
                },
              });
            }
          }
        }
      } else {
        // Registering as MANAGER or STAFF:
        // Must provide the Company Access Code set by the owner
        const requiredCode = shopSettings?.accessCode || 'SVE-2026';
        if (!data.accessCode || data.accessCode.trim() !== requiredCode) {
          return res.status(403).json({
            success: false,
            message: 'Invalid Company Access Code! Please request the company code from the Owner.',
          });
        }
      }
    }

    // Check username or email uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username.toLowerCase() },
          { email: data.email.toLowerCase() },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.username.toLowerCase() === data.username.toLowerCase()
          ? 'Username is already taken'
          : 'Email is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: data.name.trim(),
        username: data.username.toLowerCase().trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash,
        phone: data.phone || null,
        role: targetRole,
        isActive: true,
      },
    });

    // Generate JWT token for instant login
    const tokenPayload = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      success: true,
      message: `${targetRole} account registered successfully!`,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Registration failed' });
  }
};

export const validateAccessCode = async (req: Request, res: Response) => {
  try {
    const { accessCode } = req.body;
    const settings = await prisma.shopSettings.findFirst();
    const correctCode = settings?.accessCode || 'SVE-2026';

    if (!accessCode || accessCode.trim() !== correctCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Company Access Code. Please ask your shop owner for the valid access code.',
      });
    }

    res.json({
      success: true,
      valid: true,
      shopName: settings?.shopName || 'SVE Store',
      message: 'Company Access Code verified successfully!',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;

    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own active session. Ask another owner or delete via database.',
      });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete user sessions and user record
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    broadcastEvent('user_deleted', { userId });
    res.json({ success: true, message: `User "${targetUser.name}" (${targetUser.username}) deleted successfully.` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete user' });
  }
};


