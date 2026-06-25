import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await AuthService.register(req.body);
      
      res.status(201).json({
        success: true,
        data: { user, tokens },
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await AuthService.login(req.body);
      
      res.json({
        success: true,
        data: { user, tokens },
      });
    } catch (error) {
      next(error);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Refresh token required' },
        });
        return;
      }

      const tokens = await AuthService.refreshTokens(refreshToken);
      
      res.json({
        success: true,
        data: { tokens },
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1] || '';
      const { refreshToken } = req.body;

      await AuthService.logout(accessToken, refreshToken);
      
      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      next(error);
    }
  },

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: { user: req.user },
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
        return;
      }
      const user = await AuthService.updateProfile(req.userId, req.body);
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
        return;
      }
      await AuthService.changePassword(req.userId, req.body);
      res.json({
        success: true,
        data: { message: 'Password updated successfully' },
      });
    } catch (error) {
      next(error);
    }
  },
};

export default authController;
