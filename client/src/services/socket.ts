// Socket.io client service — real-time communication with the backend.

import { io, Socket } from 'socket.io-client';
import { api } from './api';

type EventCallback = (...args: any[]) => void;
type Unsubscribe = () => void;

const SOCKET_URL =
  (import.meta as any).env?.VITE_API_URL?.replace('/api', '') ||
  (import.meta as any).env?.VITE_WS_URL ||
  'http://localhost:3001';

const IS_DEV = (import.meta as any).env?.DEV === true;

class SocketService {
  private socket: Socket | null = null;

  connect(): void {
    const token = api.getAccessToken();
    if (!token) {
      if (IS_DEV) console.warn('[socket] No auth token, skipping connect.');
      return;
    }

    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    if (IS_DEV) {
      this.socket.on('connect', () => {
        // eslint-disable-next-line no-console
        console.debug('[socket] connected', this.socket?.id);
      });
      this.socket.on('disconnect', (reason) => {
        // eslint-disable-next-line no-console
        console.debug('[socket] disconnected', reason);
      });
    }

    // Always surface connection errors so the UI can react.
    this.socket.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[socket] connection error:', err.message);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Subscribe to a server-sent event. Returns an unsubscribe function. */
  on<T = any>(event: string, callback: (data: T) => void): Unsubscribe {
    this.socket?.on(event, callback);
    return () => {
      this.socket?.off(event, callback);
    };
  }

  off(event: string, callback?: EventCallback): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.removeAllListeners(event);
    }
  }

  /** Emit an event. Silently drops if not connected. */
  emit(event: string, data?: any): void {
    if (!this.socket?.connected) {
      if (IS_DEV) console.warn(`[socket] dropping event (not connected): ${event}`);
      return;
    }
    this.socket.emit(event, data);
  }

  // === ROOM MANAGEMENT ===

  joinWorkspace(workspaceId: string) {
    this.emit('join-workspace', { workspaceId });
  }
  leaveWorkspace(workspaceId: string) {
    this.emit('leave-workspace', { workspaceId });
  }
  joinDocument(documentId: string) {
    this.emit('join-document', { documentId });
  }
  leaveDocument(documentId: string) {
    this.emit('leave-document', { documentId });
  }

  // === DOCUMENT OPERATIONS ===

  updateCell(documentId: string, rowIndex: number, cellIndex: number, value: string) {
    this.emit('cell-update', { documentId, rowIndex, cellIndex, value });
  }
  addRow(documentId: string, afterRowIndex?: number) {
    this.emit('row-add', { documentId, afterRowIndex });
  }
  deleteRow(documentId: string, rowIndex: number) {
    this.emit('row-delete', { documentId, rowIndex });
  }
  moveCursor(documentId: string, rowIndex: number, cellIndex: number) {
    this.emit('cursor-move', { documentId, rowIndex, cellIndex });
  }

  // === CHAT ===

  sendMessage(workspaceId: string, content: string, replyTo?: string) {
    this.emit('send-message', { workspaceId, content, replyTo });
  }
  startTyping(workspaceId: string) {
    this.emit('typing-start', { workspaceId });
  }
  stopTyping(workspaceId: string) {
    this.emit('typing-stop', { workspaceId });
  }

  // === STATE ===

  isSocketConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socket = new SocketService();
export default socket;
