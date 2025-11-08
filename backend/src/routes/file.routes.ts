// File upload/download routes
// Handles file operations with MinIO storage

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import storageService from '../services/storage.service';
import { authenticate } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError, NotFoundError } from '../utils/errors';
import { FILE } from '../config/constants';
import { log } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE.MAX_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    // Allow all file types for now
    // Add restrictions here if needed
    cb(null, true);
  },
});

// Upload file to session
router.post(
  '/sessions/:sessionId/files/upload',
  authenticate,
  verifyCsrf,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.id;

    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    // Check if user has access to session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { user_id: userId, left_at: null },
        },
      },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    const hasAccess =
      session.owner_id === userId || session.participants.length > 0;

    if (!hasAccess) {
      throw new ValidationError('Access denied');
    }

    // Upload to MinIO
    const { storedName, storageKey, storageUrl, size } = await storageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      sessionId,
    );

    // Save to database
    const fileRecord = await prisma.sessionFile.create({
      data: {
        session_id: sessionId,
        name: req.file.originalname,
        type: 'file',
        path: req.file.originalname,
        original_name: req.file.originalname,
        stored_name: storedName,
        mime_type: req.file.mimetype,
        size,
        storage_key: storageKey,
        storage_url: storageUrl,
        uploaded_by: userId,
      },
    });

    log.info('File uploaded', {
      sessionId,
      userId,
      fileId: fileRecord.id,
      fileName: req.file.originalname,
    });

    res.status(201).json({
      success: true,
      data: {
        file: fileRecord,
      },
    });
  }),
);

// Download file from session
router.get(
  '/sessions/:sessionId/files/:fileId/download',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, fileId } = req.params;
    const userId = req.user!.id;

    // Check session access
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { user_id: userId, left_at: null },
        },
      },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    const hasAccess =
      session.owner_id === userId ||
      session.participants.length > 0 ||
      session.visibility === 'PUBLIC';

    if (!hasAccess) {
      throw new ValidationError('Access denied');
    }

    // Get file record
    const file = await prisma.sessionFile.findUnique({
      where: { id: fileId },
    });

    if (!file || file.deleted_at || !file.storage_key) {
      throw new NotFoundError('File not found');
    }

    // Download from MinIO
    const fileBuffer = await storageService.downloadFile(file.storage_key);

    // Set headers
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    res.send(fileBuffer);
  }),
);

// Get presigned URL for download
router.get(
  '/sessions/:sessionId/files/:fileId/url',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, fileId } = req.params;
    const userId = req.user!.id;
    const expirySeconds = parseInt(req.query.expiry as string) || 3600;

    // Check session access
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          where: { user_id: userId, left_at: null },
        },
      },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    const hasAccess =
      session.owner_id === userId ||
      session.participants.length > 0 ||
      session.visibility === 'PUBLIC';

    if (!hasAccess) {
      throw new ValidationError('Access denied');
    }

    // Get file record
    const file = await prisma.sessionFile.findUnique({
      where: { id: fileId },
    });

    if (!file || file.deleted_at || !file.storage_key) {
      throw new NotFoundError('File not found');
    }

    // Get presigned URL
    const url = await storageService.getPresignedUrl(file.storage_key, expirySeconds);

    res.json({
      success: true,
      data: {
        url,
        expiresIn: expirySeconds,
      },
    });
  }),
);

export default router;
