// Authentication service
// Handles user registration, login, password management

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthenticationError, ConflictError } from '../utils/errors';
import { generateToken } from '../middleware/auth';
import { log } from '../utils/logger';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  token: string;
}

export class AuthService {
  // Register new user
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, name } = input;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser && !existingUser.deleted_at) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'CREATE',
        resource_type: 'user',
        resource_id: user.id,
        details: JSON.stringify({ action: 'user_registered' }),
      },
    });

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    log.info('User registered', { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  // Login user
  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || user.deleted_at) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.password) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        resource_type: 'user',
        resource_id: user.id,
        details: JSON.stringify({ action: 'user_login' }),
      },
    });

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    log.info('User logged in', { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  // Logout user (blacklist token)
  async logout(token: string, userId: string): Promise<void> {
    // Add token to blacklist
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.tokenBlacklist.create({
      data: {
        token,
        user_id: userId,
        expires_at: expiresAt,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'LOGOUT',
        resource_type: 'user',
        resource_id: userId,
        details: JSON.stringify({ action: 'user_logout' }),
      },
    });

    log.info('User logged out', { userId });
  }

  // Change password
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deleted_at) {
      throw new AuthenticationError('User not found');
    }

    if (!user.password) {
      throw new AuthenticationError('User password not set');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE',
        resource_type: 'user',
        resource_id: userId,
        details: JSON.stringify({ action: 'password_changed' }),
      },
    });

    log.info('Password changed', { userId });
  }

  // Get current user
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        ai_cost_limit: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
      },
    });

    if (!user || user.deleted_at) {
      throw new AuthenticationError('User not found');
    }

    return user;
  }
}

export default new AuthService();
