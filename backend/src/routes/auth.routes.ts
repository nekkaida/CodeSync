// Authentication routes

import { Router, Request, Response } from 'express';
import authService from '../services/auth.service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { setTokenCookie, clearTokenCookie } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import { sanitizeEmail } from '../utils/sanitize';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';

const router = Router();

// Get CSRF token
router.get('/csrf', (req: Request, res: Response) => {
  // Token is already set by setCsrfToken middleware
  res.json({
    success: true,
    data: {
      token: req.cookies?.['csrf-token'],
    },
  });
});

// Register new user
router.post(
  '/register',
  validate(registerSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    // Sanitize email before processing
    const sanitizedData = {
      ...req.body,
      email: sanitizeEmail(req.body.email),
    };

    const { user, token } = await authService.register(sanitizedData);

    // Set token as httpOnly cookie
    setTokenCookie(res, token);

    res.status(201).json({
      success: true,
      data: { user },
    });
  }),
);

// Login
router.post(
  '/login',
  validate(loginSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    // Sanitize email before processing
    const sanitizedData = {
      ...req.body,
      email: sanitizeEmail(req.body.email),
    };

    const { user, token } = await authService.login(sanitizedData);

    // Set token as httpOnly cookie
    setTokenCookie(res, token);

    res.json({
      success: true,
      data: { user },
    });
  }),
);

// Logout
router.post(
  '/logout',
  authenticate,
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.token;
    const userId = req.user!.id;

    await authService.logout(token, userId);

    // Clear token cookie
    clearTokenCookie(res);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }),
);

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.id);

    res.json({
      success: true,
      data: { user },
    });
  }),
);

// Change password
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    await authService.changePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  }),
);

// Request password reset
router.post(
  '/forgot-password',
  validate(requestPasswordResetSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body.email);

    await authService.requestPasswordReset(email);

    // Always return success for security (don't reveal if email exists)
    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent',
    });
  }),
);

// Verify reset token
router.get(
  '/reset-password/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const isValid = await authService.verifyResetToken(token);

    if (!isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Token is valid',
    });
  }),
);

// Reset password with token
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  }),
);

export default router;
