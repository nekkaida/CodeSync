// User routes

import { Router, Request, Response } from 'express';
import userService from '../services/user.service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { authenticate, requireRole } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import {
  getUserSchema,
  updateUserSchema,
  listUsersSchema,
  updateRoleSchema,
  getUserSessionsSchema,
  getAIUsageSchema,
  getAuditLogSchema,
} from '../validators/user.validator';

const router = Router();

// Get user by ID
router.get(
  '/:userId',
  authenticate,
  validate(getUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUserById(req.params.userId, req.user!.id);

    res.json({
      success: true,
      data: { user },
    });
  }),
);

// Update user profile
router.patch(
  '/:userId',
  authenticate,
  validate(updateUserSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateUser(req.params.userId, req.user!.id, req.body);

    res.json({
      success: true,
      data: { user },
    });
  }),
);

// Delete user
router.delete(
  '/:userId',
  authenticate,
  validate(getUserSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteUser(req.params.userId, req.user!.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  }),
);

// Get user's sessions
router.get(
  '/:userId/sessions',
  authenticate,
  validate(getUserSessionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await userService.getUserSessions(
      req.params.userId,
      Number(req.query.limit),
      Number(req.query.offset),
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Get user's AI usage statistics
router.get(
  '/:userId/ai-usage',
  authenticate,
  validate(getAIUsageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await userService.getAIUsageStats(req.params.userId, Number(req.query.days));

    res.json({
      success: true,
      data: stats,
    });
  }),
);

// Get user's audit log
router.get(
  '/:userId/audit-log',
  authenticate,
  validate(getAuditLogSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await userService.getAuditLog(
      req.params.userId,
      Number(req.query.limit),
      Number(req.query.offset),
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Admin routes

// List all users (admin only)
router.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(listUsersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await userService.listUsers(req.user!.id, {
      role: req.query.role as any,
      limit: Number(req.query.limit),
      offset: Number(req.query.offset),
    });

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Update user role (admin only)
router.patch(
  '/:userId/role',
  authenticate,
  requireRole('ADMIN'),
  validate(updateRoleSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateUserRole(req.params.userId, req.body.role, req.user!.id);

    res.json({
      success: true,
      data: { user },
    });
  }),
);

export default router;
