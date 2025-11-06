// Session service
// Handles collaborative coding sessions

import {
  PrismaClient,
  ProgrammingLanguage,
  SessionVisibility,
  ParticipantRole,
} from '@prisma/client';
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors';
import { log } from '../utils/logger';
import { sessionsActive } from '../utils/metrics';

const prisma = new PrismaClient();

interface CreateSessionInput {
  name: string;
  description?: string;
  language: ProgrammingLanguage;
  visibility: SessionVisibility;
  ownerId: string;
}

interface UpdateSessionInput {
  name?: string;
  description?: string;
  language?: ProgrammingLanguage;
  visibility?: SessionVisibility;
  status?: 'ACTIVE' | 'ARCHIVED' | 'PAUSED';
}

interface AddParticipantInput {
  sessionId: string;
  userId: string;
  role: ParticipantRole;
}

export class SessionService {
  // Create new session
  async createSession(input: CreateSessionInput) {
    const { name, description, language, visibility, ownerId } = input;

    const session = await prisma.session.create({
      data: {
        name,
        description,
        language,
        visibility,
        status: 'ACTIVE',
        owner_id: ownerId,
        participants: {
          create: {
            user_id: ownerId,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: ownerId,
        action: 'CREATE',
        resource_type: 'session',
        resource_id: session.id,
        details: JSON.stringify({ name, language, visibility }),
      },
    });

    // Update metrics
    sessionsActive.inc();

    log.info('Session created', { sessionId: session.id, ownerId });

    return session;
  }

  // Get session by ID
  async getSession(sessionId: string, userId?: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          where: {
            left_at: null,
          },
        },
        files: {
          where: {
            deleted_at: null,
          },
        },
      },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check access permissions
    if (session.visibility === 'PRIVATE' && userId) {
      const hasAccess =
        session.owner_id === userId || session.participants.some((p) => p.user_id === userId);

      if (!hasAccess) {
        throw new AuthorizationError('Access denied to this session');
      }
    }

    return session;
  }

  // List sessions (with filters)
  async listSessions(filters: {
    userId?: string;
    visibility?: SessionVisibility;
    language?: ProgrammingLanguage;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const { userId, visibility, language, status, limit = 20, offset = 0 } = filters;

    const where: any = {
      deleted_at: null,
    };

    // Filter by visibility
    if (visibility) {
      where.visibility = visibility;
    } else if (userId) {
      // Show user's sessions and public sessions
      where.OR = [
        { visibility: 'PUBLIC' },
        { visibility: 'UNLISTED' },
        { owner_id: userId },
        { participants: { some: { user_id: userId } } },
      ];
    } else {
      // Only show public sessions for anonymous users
      where.visibility = 'PUBLIC';
    }

    if (language) {
      where.language = language;
    }

    if (status) {
      where.status = status;
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          participants: {
            where: {
              left_at: null,
            },
            select: {
              user_id: true,
              role: true,
            },
          },
        },
        orderBy: {
          last_activity: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.session.count({ where }),
    ]);

    return {
      sessions,
      total,
      limit,
      offset,
    };
  }

  // Update session
  async updateSession(sessionId: string, userId: string, input: UpdateSessionInput) {
    // Check if user is owner
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    if (session.owner_id !== userId) {
      throw new AuthorizationError('Only session owner can update settings');
    }

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        ...input,
        last_activity: new Date(),
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'UPDATE',
        resource_type: 'session',
        resource_id: sessionId,
        details: JSON.stringify(input),
      },
    });

    log.info('Session updated', { sessionId, userId });

    return updated;
  }

  // Delete session (soft delete)
  async deleteSession(sessionId: string, userId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    if (session.owner_id !== userId) {
      throw new AuthorizationError('Only session owner can delete session');
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        deleted_at: new Date(),
        deleted_by: userId,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'DELETE',
        resource_type: 'session',
        resource_id: sessionId,
        details: JSON.stringify({ name: session.name }),
      },
    });

    // Update metrics
    sessionsActive.dec();

    log.info('Session deleted', { sessionId, userId });
  }

  // Add participant to session
  async addParticipant(input: AddParticipantInput) {
    const { sessionId, userId, role } = input;

    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user already a participant
    const existing = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (existing) {
      throw new ValidationError('User is already a participant');
    }

    const participant = await prisma.participant.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update session activity
    await prisma.session.update({
      where: { id: sessionId },
      data: { last_activity: new Date() },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'JOIN',
        resource_type: 'session',
        resource_id: sessionId,
        details: JSON.stringify({ role }),
      },
    });

    log.info('Participant added', { sessionId, userId, role });

    return participant;
  }

  // Remove participant from session
  async removeParticipant(sessionId: string, userId: string, removedBy: string) {
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant) {
      throw new NotFoundError('Participant not found');
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: { left_at: new Date() },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: removedBy,
        action: 'LEAVE',
        resource_type: 'session',
        resource_id: sessionId,
        details: JSON.stringify({ removed_user: userId }),
      },
    });

    log.info('Participant removed', { sessionId, userId });
  }

  // Update participant cursor position
  async updateCursorPosition(sessionId: string, userId: string, line: number, column: number) {
    await prisma.participant.updateMany({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
      data: {
        cursor_line: line,
        cursor_column: column,
        last_seen: new Date(),
      },
    });
  }

  // Get session content
  async getSessionContent(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId, userId);

    // For now, return empty content or stored content
    // In future, this could load from storage service
    return session.description || '';
  }

  // Update session content
  async updateSessionContent(sessionId: string, userId: string, content: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user is participant
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant && session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to update session content');
    }

    // Update last activity
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        last_activity: new Date(),
      },
    });

    log.info('Session content updated', { sessionId, userId, contentLength: content.length });
  }

  // Get session files
  async getSessionFiles(sessionId: string, userId: string) {
    await this.getSession(sessionId, userId); // Check access

    // Return default file structure for now
    return [
      {
        id: '1',
        name: 'main.js',
        type: 'file',
        path: 'main.js',
      },
    ];
  }

  // Create file in session
  async createFile(sessionId: string, userId: string, name: string, type: 'file' | 'folder') {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user is participant
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant && session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to create files');
    }

    const file = {
      id: Date.now().toString(),
      name,
      type,
      path: name,
    };

    log.info('File created', { sessionId, userId, fileName: name, type });

    return file;
  }

  // Delete file in session
  async deleteFile(sessionId: string, userId: string, fileId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user is participant
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant && session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to delete files');
    }

    log.info('File deleted', { sessionId, userId, fileId });
  }

  // Get file content by path
  async getFileContent(sessionId: string, userId: string, filePath: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user has access
    if (session.visibility !== 'PUBLIC') {
      const participant = await prisma.participant.findFirst({
        where: {
          session_id: sessionId,
          user_id: userId,
          left_at: null,
        },
      });

      if (!participant && session.owner_id !== userId) {
        throw new AuthorizationError('Not authorized to access this session');
      }
    }

    // Get file from database
    const file = await prisma.sessionFile.findFirst({
      where: {
        session_id: sessionId,
        path: filePath,
        deleted_at: null,
      },
    });

    return file?.content || '';
  }

  // Update file content by path
  async updateFileContent(sessionId: string, userId: string, filePath: string, content: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user is participant
    const participant = await prisma.participant.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        left_at: null,
      },
    });

    if (!participant && session.owner_id !== userId) {
      throw new AuthorizationError('Not authorized to edit this session');
    }

    // Upsert file content
    await prisma.sessionFile.upsert({
      where: {
        session_id_path: {
          session_id: sessionId,
          path: filePath,
        },
      },
      update: {
        content,
        updated_at: new Date(),
      },
      create: {
        session_id: sessionId,
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        type: 'file',
        content,
      },
    });

    log.debug('File content updated', { sessionId, userId, filePath });
  }

  // Search across session files
  async searchFiles(
    sessionId: string,
    userId: string,
    query: string,
    options: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean } = {}
  ) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deleted_at) {
      throw new NotFoundError('Session not found');
    }

    // Check if user has access
    if (session.visibility !== 'PUBLIC') {
      const participant = await prisma.participant.findFirst({
        where: {
          session_id: sessionId,
          user_id: userId,
          left_at: null,
        },
      });

      if (!participant && session.owner_id !== userId) {
        throw new AuthorizationError('Not authorized to access this session');
      }
    }

    // Get all files in session
    const files = await prisma.sessionFile.findMany({
      where: {
        session_id: sessionId,
        deleted_at: null,
        type: 'file',
      },
      select: {
        path: true,
        content: true,
      },
    });

    const results: any[] = [];

    // Build search pattern
    let pattern: RegExp;
    try {
      if (options.regex) {
        pattern = new RegExp(
          query,
          options.caseSensitive ? 'g' : 'gi'
        );
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundary = options.wholeWord ? '\\b' : '';
        pattern = new RegExp(
          `${wordBoundary}${escapedQuery}${wordBoundary}`,
          options.caseSensitive ? 'g' : 'gi'
        );
      }
    } catch (error) {
      throw new ValidationError('Invalid search pattern');
    }

    // Search in each file
    for (const file of files) {
      if (!file.content) continue;

      const lines = file.content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let match;

        while ((match = pattern.exec(line)) !== null) {
          results.push({
            filePath: file.path,
            line: lineIndex + 1,
            column: match.index + 1,
            content: line.trim(),
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });

          // Prevent infinite loop on zero-length matches
          if (match.index === pattern.lastIndex) {
            pattern.lastIndex++;
          }
        }

        // Reset regex lastIndex for next line
        pattern.lastIndex = 0;
      }
    }

    log.debug('Search performed', { sessionId, userId, query, resultsCount: results.length });

    return results;
  }
}

export default new SessionService();
