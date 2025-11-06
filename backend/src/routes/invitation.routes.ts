// Session invitation routes

import { Router, Request, Response } from 'express';
import invitationService from '../services/invitation.service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { authenticate, optionalAuth } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import {
  createInvitationSchema,
  acceptInvitationSchema,
  listInvitationsSchema,
} from '../validators/invitation.validator';

const router = Router();

// Create invitation
router.post(
  '/',
  authenticate,
  validate(createInvitationSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const invitation = await invitationService.createInvitation({
      sessionId: req.body.sessionId,
      email: req.body.email,
      role: req.body.role,
      invitedBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: { invitation },
    });
  }),
);

// List invitations for a session
router.get(
  '/session/:sessionId',
  authenticate,
  validate(listInvitationsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const invitations = await invitationService.listInvitations(
      req.params.sessionId,
      req.user!.id,
    );

    res.json({
      success: true,
      data: { invitations },
    });
  }),
);

// Accept invitation
router.post(
  '/accept/:token',
  optionalAuth,
  validate(acceptInvitationSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await invitationService.acceptInvitation(
      req.params.token,
      req.user?.id,
      req.body.email,
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Revoke invitation
router.delete(
  '/:invitationId',
  authenticate,
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    await invitationService.revokeInvitation(
      req.params.invitationId,
      req.user!.id,
    );

    res.json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  }),
);

// Get invitation by token (public)
router.get(
  '/verify/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const invitation = await invitationService.getInvitationByToken(req.params.token);

    res.json({
      success: true,
      data: { invitation },
    });
  }),
);

export default router;
