import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User } from '../models/index.js';
import { redis } from '../config/redis.js';
import type { UserPublic, UserRole } from '@shared/types/index.js';

export interface AuthRequest extends Request {
  user?: UserPublic;
  userId?: string;
}

interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided',
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Check if token is blacklisted (logged out)
    try {
      const isBlacklisted = await redis.get(`token:blacklist:${token}`);
      if (isBlacklisted) {
        res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked. Please sign in again.',
          },
        });
        return;
      }
    } catch {
      // Redis unavailable — skip blacklist check (graceful degradation)
    }
    
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    
    req.userId = decoded.userId;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      name: '',
      avatar: '',
      color: '',
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        },
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
}

export async function loadFullUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      next();
      return;
    }

    const user = await User.findById(req.userId);
    
    if (user) {
      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        avatar: user.avatar,
        color: user.color,
      };
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  authenticate(req, res, next);
}
