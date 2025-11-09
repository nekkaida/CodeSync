// Session routes

import { Router, Request, Response } from 'express';
import sessionService from '../services/session.service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { authenticate, optionalAuth } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import { rateLimit } from '../middleware/rateLimit.redis';
import { sanitizeFilePath, sanitizeSearchQuery, sanitizeRegex } from '../utils/sanitize';
import {
  createSessionSchema,
  updateSessionSchema,
  getSessionSchema,
  listSessionsSchema,
  addParticipantSchema,
  removeParticipantSchema,
  updateCursorSchema,
} from '../validators/session.validator';

const router = Router();

// Create new session
router.post(
  '/',
  authenticate,
  validate(createSessionSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const session = await sessionService.createSession({
      ...req.body,
      ownerId: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: { session },
    });
  }),
);

// List sessions
router.get(
  '/',
  optionalAuth,
  validate(listSessionsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sessionService.listSessions({
      ...req.query,
      userId: req.user?.id,
    } as any);

    res.json({
      success: true,
      data: result,
    });
  }),
);

// Get session by ID
router.get(
  '/:sessionId',
  optionalAuth,
  validate(getSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await sessionService.getSession(req.params.sessionId, req.user?.id);

    res.json({
      success: true,
      data: { session },
    });
  }),
);

// Update session
router.patch(
  '/:sessionId',
  authenticate,
  validate(updateSessionSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const session = await sessionService.updateSession(
      req.params.sessionId,
      req.user!.id,
      req.body,
    );

    res.json({
      success: true,
      data: { session },
    });
  }),
);

// Delete session
router.delete(
  '/:sessionId',
  authenticate,
  validate(getSessionSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    await sessionService.deleteSession(req.params.sessionId, req.user!.id);

    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  }),
);

// Add participant to session
router.post(
  '/:sessionId/participants',
  authenticate,
  validate(addParticipantSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const participant = await sessionService.addParticipant({
      sessionId: req.params.sessionId,
      userId: req.body.userId,
      role: req.body.role,
    });

    res.status(201).json({
      success: true,
      data: { participant },
    });
  }),
);

// Remove participant from session
router.delete(
  '/:sessionId/participants/:userId',
  authenticate,
  validate(removeParticipantSchema),
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    await sessionService.removeParticipant(req.params.sessionId, req.params.userId, req.user!.id);

    res.json({
      success: true,
      message: 'Participant removed successfully',
    });
  }),
);

// Update cursor position
router.post(
  '/:sessionId/cursor',
  authenticate,
  validate(updateCursorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await sessionService.updateCursorPosition(
      req.params.sessionId,
      req.user!.id,
      req.body.line,
      req.body.column,
    );

    res.json({
      success: true,
      message: 'Cursor position updated',
    });
  }),
);

// Get session content
router.get(
  '/:sessionId/content',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const content = await sessionService.getSessionContent(req.params.sessionId, req.user!.id);

    res.json({
      success: true,
      data: { content },
    });
  }),
);

// Update session content
router.put(
  '/:sessionId/content',
  authenticate,
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    await sessionService.updateSessionContent(
      req.params.sessionId,
      req.user!.id,
      req.body.content,
    );

    res.json({
      success: true,
      message: 'Content saved successfully',
    });
  }),
);

// Get session files
router.get(
  '/:sessionId/files',
  authenticate,
  rateLimit({ type: 'API', maxRequests: 60, windowMs: 60 * 1000 }),
  asyncHandler(async (req: Request, res: Response) => {
    const files = await sessionService.getSessionFiles(req.params.sessionId, req.user!.id);

    res.json({
      success: true,
      data: { files },
    });
  }),
);

// Create file/folder in session
router.post(
  '/:sessionId/files',
  authenticate,
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    const file = await sessionService.createFile(
      req.params.sessionId,
      req.user!.id,
      req.body.name,
      req.body.type,
    );

    res.status(201).json({
      success: true,
      data: { file },
    });
  }),
);

// Delete file/folder
router.delete(
  '/:sessionId/files/:fileId',
  authenticate,
  verifyCsrf,
  asyncHandler(async (req: Request, res: Response) => {
    await sessionService.deleteFile(
      req.params.sessionId,
      req.user!.id,
      req.params.fileId,
    );

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  }),
);

// Get file content by path
router.get(
  '/:sessionId/files/:filePath*/content',
  authenticate,
  rateLimit({ type: 'API', maxRequests: 60, windowMs: 60 * 1000 }),
  asyncHandler(async (req: Request, res: Response) => {
    const filePath = req.params.filePath + (req.params[0] || '');
    const sanitizedPath = sanitizeFilePath(decodeURIComponent(filePath));
    const content = await sessionService.getFileContent(
      req.params.sessionId,
      req.user!.id,
      sanitizedPath,
    );

    res.json({
      success: true,
      data: { content },
    });
  }),
);

// Update file content by path
router.put(
  '/:sessionId/files/:filePath*/content',
  authenticate,
  verifyCsrf,
  rateLimit({ type: 'API', maxRequests: 60, windowMs: 60 * 1000 }),
  asyncHandler(async (req: Request, res: Response) => {
    const filePath = req.params.filePath + (req.params[0] || '');
    const sanitizedPath = sanitizeFilePath(decodeURIComponent(filePath));
    await sessionService.updateFileContent(
      req.params.sessionId,
      req.user!.id,
      sanitizedPath,
      req.body.content,
    );

    res.json({
      success: true,
      message: 'File content saved successfully',
    });
  }),
);

// Search across session files
router.post(
  '/:sessionId/search',
  authenticate,
  rateLimit({ type: 'API', maxRequests: 30, windowMs: 60 * 1000 }),
  asyncHandler(async (req: Request, res: Response) => {
    const { query, regex, caseSensitive, wholeWord } = req.body;

    // Sanitize search query
    const sanitizedQuery = sanitizeSearchQuery(query);

    // If using regex mode, validate the regex pattern
    let searchPattern = sanitizedQuery;
    if (regex) {
      const regexObj = sanitizeRegex(sanitizedQuery, caseSensitive ? '' : 'i');
      searchPattern = regexObj.source;
    }

    const results = await sessionService.searchFiles(
      req.params.sessionId,
      req.user!.id,
      searchPattern,
      { regex, caseSensitive, wholeWord }
    );

    res.json({
      success: true,
      data: { results },
    });
  }),
);

export default router;
