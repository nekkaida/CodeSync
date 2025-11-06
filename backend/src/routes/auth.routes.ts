// Authentication routes

import { Router, Request, Response } from 'express';
import authService from '../services/auth.service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { setTokenCookie, clearTokenCookie } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/auth.validator';

const router = Router();

// Register new user
router.post(
  '/register',
  validate(registerSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const { user, token } = await authService.register(req.body);

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
    const { user, token } = await authService.login(req.body);

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

export default router;
