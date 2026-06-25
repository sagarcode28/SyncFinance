import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User } from '../models/index.js';
import { redis } from '../config/redis.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthTokens, UserPublic, UserRole, RegisterRequest, LoginRequest } from '@shared/types/index.js';

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class AuthService {
  private static readonly TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';
  private static readonly REFRESH_TOKEN_PREFIX = 'refresh:';

  static async register(data: RegisterRequest): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      password: data.password,
      role: data.role || 'viewer',
    });

    const tokens = await this.generateTokens(user._id.toString(), user.email, user.role as UserRole);
    
    // Store refresh token hash
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        avatar: user.avatar,
        color: user.color,
      },
      tokens,
    };
  }

  static async login(data: LoginRequest): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const user = await User.findOne({ email: data.email.toLowerCase() }).select('+password');
    
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await user.comparePassword(data.password);
    
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const tokens = await this.generateTokens(user._id.toString(), user.email, user.role as UserRole);
    
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        avatar: user.avatar,
        color: user.color,
      },
      tokens,
    };
  }

  static async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as {
        userId: string;
        email: string;
        role: UserRole;
      };

      // Verify token is not blacklisted
      const isBlacklisted = await redis.get(`${this.TOKEN_BLACKLIST_PREFIX}${refreshToken}`);
      if (isBlacklisted) {
        throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }

      // Verify user still exists
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new AppError('User not found', 401, 'USER_NOT_FOUND');
      }

      // Revoke old refresh token
      await this.revokeRefreshToken(refreshToken);

      // Generate new tokens
      const tokens = await this.generateTokens(user._id.toString(), user.email, user.role as UserRole);
      
      await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

      return tokens;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }
  }

  static async logout(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // Blacklist access token
      const decoded = jwt.decode(accessToken) as { exp: number } | null;
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`${this.TOKEN_BLACKLIST_PREFIX}${accessToken}`, ttl, '1');
        }
      }

      // Revoke refresh token
      if (refreshToken) {
        await this.revokeRefreshToken(refreshToken);
      }
    } catch (error) {
      // Log but don't throw - logout should always succeed
      console.error('Logout error:', error);
    }
  }

  private static async generateTokens(userId: string, email: string, role: UserRole): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { userId, email, role },
      config.jwtSecret as string,
      { expiresIn: config.jwtExpiresIn as any }
    );

    const refreshToken = jwt.sign(
      { userId, email, role, type: 'refresh' },
      config.jwtRefreshSecret as string,
      { expiresIn: config.jwtRefreshExpiresIn as any }
    );

    return { accessToken, refreshToken };
  }

  private static async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // Store with 7-day TTL
    await redis.setex(
      `${this.REFRESH_TOKEN_PREFIX}${userId}`,
      7 * 24 * 60 * 60,
      refreshToken
    );
  }

  private static async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.decode(refreshToken) as { userId: string; exp: number } | null;
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`${this.TOKEN_BLACKLIST_PREFIX}${refreshToken}`, ttl, '1');
        }
      }
    } catch (error) {
      // Ignore decode errors
    }
  }

  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await redis.get(`${this.TOKEN_BLACKLIST_PREFIX}${token}`);
    return result === '1';
  }

  /**
   * Update mutable profile fields (name, email). Returns the refreshed
   * public user representation. Throws if email is already taken.
   */
  static async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserPublic> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (data.email && data.email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: data.email.toLowerCase() });
      if (existing && existing._id.toString() !== userId) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }
      user.email = data.email.toLowerCase();
    }

    if (data.name && data.name !== user.name) {
      user.name = data.name;
      // Regenerate avatar initials when the name changes.
      user.avatar = data.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    await user.save();

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      avatar: user.avatar,
      color: user.color,
    };
  }

  /**
   * Change a user's password. Verifies the current password, sets the new
   * one, and revokes all existing refresh tokens for that user.
   */
  static async changePassword(userId: string, data: ChangePasswordInput): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const valid = await user.comparePassword(data.currentPassword);
    if (!valid) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
    }

    user.password = data.newPassword;
    await user.save();

    // Revoke any cached refresh token for this user — force re-login on other devices.
    try {
      await redis.del(`${this.REFRESH_TOKEN_PREFIX}${userId}`);
    } catch {
      // Redis unavailable — graceful degradation.
    }
  }
}

export default AuthService;
