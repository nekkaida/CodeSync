// Snapshot validators

import { z } from 'zod';

export const createSnapshotSchema = z.object({
  body: z.object({
    sessionId: z.string().cuid(),
    yjsState: z.string().min(1),
    changeSummary: z.string().optional(),
    linesAdded: z.number().int().nonnegative().optional(),
    linesRemoved: z.number().int().nonnegative().optional(),
  }),
});

export const listSnapshotsSchema = z.object({
  params: z.object({
    sessionId: z.string().cuid(),
  }),
  query: z.object({
    limit: z.string().optional(),
    offset: z.string().optional(),
  }),
});

export const getSnapshotSchema = z.object({
  params: z.object({
    snapshotId: z.string().cuid(),
  }),
});

export const restoreSnapshotSchema = z.object({
  params: z.object({
    snapshotId: z.string().cuid(),
  }),
});
