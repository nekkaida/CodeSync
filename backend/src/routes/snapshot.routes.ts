// Code snapshot routes (version history)

import { Router, Request, Response } from 'express';
import snapshotService from '../services/snapshot.service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import {
  createSnapshotSchema,
  listSnapshotsSchema,
  getSnapshotSchema,
  restoreSnapshotSchema,
} from '../validators/snapshot.validator';

const router = Router();

// Create snapshot
router.post(
  '/',
  authenticate,
  validate(createSnapshotSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const snapshot = await snapshotService.createSnapshot({
      sessionId: req.body.sessionId,
      yjsState: req.body.yjsState,
      changeSummary: req.body.changeSummary,
      linesAdded: req.body.linesAdded,
      linesRemoved: req.body.linesRemoved,
      userId: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: { snapshot },
    });
  }),
);

// List snapshots for session
router.get(
  '/session/:sessionId',
  authenticate,
  validate(listSnapshotsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const snapshots = await snapshotService.listSnapshots(
      req.params.sessionId,
      req.user!.id,
      {
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      },
    );

    res.json({
      success: true,
      data: snapshots,
    });
  }),
);

// Get snapshot by ID
router.get(
  '/:snapshotId',
  authenticate,
  validate(getSnapshotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const snapshot = await snapshotService.getSnapshot(
      req.params.snapshotId,
      req.user!.id,
    );

    res.json({
      success: true,
      data: { snapshot },
    });
  }),
);

// Restore snapshot
router.post(
  '/:snapshotId/restore',
  authenticate,
  validate(restoreSnapshotSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await snapshotService.restoreSnapshot(
      req.params.snapshotId,
      req.user!.id,
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Delete snapshot
router.delete(
  '/:snapshotId',
  authenticate,
  validate(getSnapshotSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    await snapshotService.deleteSnapshot(
      req.params.snapshotId,
      req.user!.id,
    );

    res.json({
      success: true,
      message: 'Snapshot deleted successfully',
    });
  }),
);

export default router;
