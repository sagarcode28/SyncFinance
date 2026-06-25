import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import config from '../config/index.js';
import RedisClient, { redis } from '../config/redis.js';
import { User, Workspace } from '../models/index.js';
import { DocumentService } from '../services/DocumentService.js';
import { ChatService } from '../services/ChatService.js';
import type { UserPublic, UserRole, CursorPosition } from '@shared/types/index.js';

interface AuthenticatedSocket extends Socket {
  userId: string;
  user: UserPublic;
}

interface PresenceData {
  userId: string;
  userName: string;
  userAvatar: string;
  userColor: string;
  workspaceId?: string;
  documentId?: string;
  cursor?: CursorPosition;
  status: 'online' | 'away' | 'busy';
  lastSeen: string;
}

const PRESENCE_TTL = 60; // seconds
const TYPING_TTL = 5; // seconds

// Module-level reference so REST controllers can broadcast over sockets
// (e.g. notify document collaborators when a version is saved via HTTP).
let ioInstance: SocketServer | null = null;
export function getIO(): SocketServer | null {
  return ioInstance;
}

export function initializeSocket(httpServer: HttpServer): SocketServer {
  // Match the HTTP CORS policy: accept configured CLIENT_URL(s) plus any localhost in dev
  const allowedOrigins = config.clientUrl.split(',').map((o) => o.trim()).filter(Boolean);
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  const io = new SocketServer(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (config.nodeEnv !== 'production' && localhostRegex.test(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  ioInstance = io;

  // Use the official Redis adapter so io.to(room).emit(...) and socket.to(room).emit(...)
  // fan out correctly across multiple server instances (horizontal scaling) without
  // requiring any manual publish/subscribe in service code.
  try {
    const pubClient = RedisClient.getPublisher();
    const subClient = RedisClient.getSubscriber();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.io Redis adapter attached');
  } catch (error) {
    console.warn('⚠️  Socket.io Redis adapter unavailable — falling back to in-memory adapter:', error);
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as {
        userId: string;
        email: string;
        role: UserRole;
      };

      // Check blacklist
      try {
        const isBlacklisted = await redis.get(`token:blacklist:${token}`);
        if (isBlacklisted) {
          return next(new Error('Token revoked'));
        }
      } catch {
        // Redis unavailable - continue
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        avatar: user.avatar,
        color: user.color,
      };

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    console.log(`User connected: ${authSocket.user.name} (${authSocket.userId})`);

    // Set user as online
    setUserPresence(authSocket.userId, {
      userId: authSocket.user.id,
      userName: authSocket.user.name,
      userAvatar: authSocket.user.avatar,
      userColor: authSocket.user.color,
      status: 'online',
      lastSeen: new Date().toISOString(),
    });

    // === WORKSPACE EVENTS ===
    
    socket.on('join-workspace', async ({ workspaceId }) => {
      try {
        // Verify user has access
        const workspace = await Workspace.findById(workspaceId);
        const member = workspace?.members.find((m: any) => m.userId === authSocket.userId);
        
        if (!member) {
          socket.emit('error', { code: 'ACCESS_DENIED', message: 'No access to workspace' });
          return;
        }

        socket.join(`workspace:${workspaceId}`);
        
        // Update presence
        await updatePresence(authSocket.userId, { workspaceId });

        // Notify others
        socket.to(`workspace:${workspaceId}`).emit('user-joined', {
          userId: authSocket.userId,
          user: authSocket.user,
        });

        // Send current online users in workspace
        const onlineUsers = await getWorkspacePresence(workspaceId);
        socket.emit('workspace-presence', { workspaceId, users: onlineUsers });

        console.log(`${authSocket.user.name} joined workspace ${workspaceId}`);
      } catch (error) {
        console.error('Join workspace error:', error);
        socket.emit('error', { code: 'JOIN_ERROR', message: 'Failed to join workspace' });
      }
    });

    socket.on('leave-workspace', async ({ workspaceId }) => {
      socket.leave(`workspace:${workspaceId}`);
      await updatePresence(authSocket.userId, { workspaceId: undefined });
      
      socket.to(`workspace:${workspaceId}`).emit('user-left', {
        userId: authSocket.userId,
      });
    });

    // === DOCUMENT EVENTS ===

    socket.on('join-document', async ({ documentId }) => {
      try {
        await DocumentService.findById(documentId, authSocket.userId);
        
        socket.join(`document:${documentId}`);
        await updatePresence(authSocket.userId, { documentId });

        socket.to(`document:${documentId}`).emit('user-joined', {
          userId: authSocket.userId,
          user: authSocket.user,
        });

        // Send current users editing the document
        const editors = await getDocumentPresence(documentId);
        socket.emit('document-presence', { documentId, users: editors });

        console.log(`${authSocket.user.name} joined document ${documentId}`);
      } catch (error) {
        socket.emit('error', { code: 'JOIN_ERROR', message: 'Failed to join document' });
      }
    });

    socket.on('leave-document', async ({ documentId }) => {
      socket.leave(`document:${documentId}`);
      await updatePresence(authSocket.userId, { documentId: undefined, cursor: undefined });
      
      socket.to(`document:${documentId}`).emit('user-left', {
        userId: authSocket.userId,
      });
    });

    socket.on('cell-update', async ({ documentId, rowIndex, cellIndex, value, clientVersion }) => {
      try {
        const { document, change } = await DocumentService.updateCell(
          documentId,
          authSocket.userId,
          rowIndex,
          cellIndex,
          value,
          clientVersion
        );

        // Broadcast to all users in document except sender
        socket.to(`document:${documentId}`).emit('cell-updated', {
          documentId,
          rowIndex,
          cellIndex,
          value,
          userId: authSocket.userId,
          user: authSocket.user,
          change,
        });

        // Confirm to sender
        socket.emit('cell-update-ack', { documentId, rowIndex, cellIndex, success: true });
      } catch (error: any) {
        socket.emit('cell-update-ack', {
          documentId,
          rowIndex,
          cellIndex,
          success: false,
          error: error.message,
        });
      }
    });

    socket.on('row-add', async ({ documentId, afterRowIndex }) => {
      try {
        const { document, row } = await DocumentService.addRow(documentId, authSocket.userId, afterRowIndex);

        socket.to(`document:${documentId}`).emit('row-added', {
          documentId,
          row,
          afterRowIndex,
          userId: authSocket.userId,
        });

        socket.emit('row-add-ack', { documentId, row, success: true });
      } catch (error: any) {
        socket.emit('row-add-ack', { documentId, success: false, error: error.message });
      }
    });

    socket.on('row-delete', async ({ documentId, rowIndex }) => {
      try {
        await DocumentService.deleteRow(documentId, authSocket.userId, rowIndex);

        socket.to(`document:${documentId}`).emit('row-deleted', {
          documentId,
          rowIndex,
          userId: authSocket.userId,
        });

        socket.emit('row-delete-ack', { documentId, rowIndex, success: true });
      } catch (error: any) {
        socket.emit('row-delete-ack', { documentId, success: false, error: error.message });
      }
    });

    socket.on('cursor-move', async ({ documentId, rowIndex, cellIndex }) => {
      await updatePresence(authSocket.userId, {
        cursor: { rowIndex, cellIndex },
      });

      socket.to(`document:${documentId}`).emit('cursor-moved', {
        documentId,
        userId: authSocket.userId,
        user: authSocket.user,
        rowIndex,
        cellIndex,
      });
    });

    // === CHAT EVENTS ===

    socket.on('send-message', async ({ workspaceId, content, replyTo }) => {
      try {
        const message = await ChatService.sendMessage(authSocket.userId, {
          workspaceId,
          content,
          replyTo,
        });

        // Broadcast to all users in workspace including sender
        io.to(`workspace:${workspaceId}`).emit('new-message', message);
      } catch (error: any) {
        socket.emit('error', { code: 'MESSAGE_ERROR', message: error.message });
      }
    });

    socket.on('typing-start', async ({ workspaceId }) => {
      await redis.setex(`typing:${workspaceId}:${authSocket.userId}`, TYPING_TTL, '1');
      
      socket.to(`workspace:${workspaceId}`).emit('user-typing', {
        workspaceId,
        userId: authSocket.userId,
        user: authSocket.user,
      });
    });

    socket.on('typing-stop', async ({ workspaceId }) => {
      await redis.del(`typing:${workspaceId}:${authSocket.userId}`);
      
      socket.to(`workspace:${workspaceId}`).emit('user-stopped-typing', {
        workspaceId,
        userId: authSocket.userId,
      });
    });

    // === DISCONNECT ===

    // Notify peers BEFORE Socket.io flushes our room memberships.
    // 'disconnect' fires after rooms are cleared, so we'd find nothing to broadcast to.
    socket.on('disconnecting', () => {
      try {
        for (const room of socket.rooms) {
          if (room.startsWith('workspace:') || room.startsWith('document:')) {
            socket.to(room).emit('user-left', { userId: authSocket.userId });
          }
        }
      } catch (error) {
        console.error('Disconnecting broadcast error:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${authSocket.user.name}`);
      await removePresence(authSocket.userId);
    });
  });

  return io;
}

// === PRESENCE HELPERS ===

async function setUserPresence(userId: string, data: PresenceData): Promise<void> {
  try {
    await redis.setex(`presence:${userId}`, PRESENCE_TTL, JSON.stringify(data));
  } catch { /* Redis unavailable */ }
}

async function updatePresence(userId: string, updates: Partial<PresenceData>): Promise<void> {
  try {
    const existing = await redis.get(`presence:${userId}`);
    const data = existing ? JSON.parse(existing) : {};
    
    await redis.setex(
      `presence:${userId}`,
      PRESENCE_TTL,
      JSON.stringify({ ...data, ...updates, lastSeen: new Date().toISOString() })
    );
  } catch { /* Redis unavailable */ }
}

async function removePresence(userId: string): Promise<void> {
  try {
    await redis.del(`presence:${userId}`);
  } catch { /* Redis unavailable */ }
}

async function getWorkspacePresence(workspaceId: string): Promise<PresenceData[]> {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return [];

    const presence: PresenceData[] = [];
    
    for (const member of workspace.members) {
      const data = await redis.get(`presence:${member.userId}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.workspaceId === workspaceId) {
          presence.push(parsed);
        }
      }
    }

    return presence;
  } catch {
    return [];
  }
}

async function getDocumentPresence(documentId: string): Promise<PresenceData[]> {
  try {
    // Use Redis SCAN instead of KEYS for production safety
    const keys = await redis.keys('presence:*');
    const presence: PresenceData[] = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.documentId === documentId) {
          presence.push(parsed);
        }
      }
    }

    return presence;
  } catch {
    return [];
  }
}

export default initializeSocket;
