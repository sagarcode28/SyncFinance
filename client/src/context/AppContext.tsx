import React, { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import type {
  User, Workspace, FinancialDocument, ChatMessage, AuditLog,
  Notification, Page, SpreadsheetRow, WorkspaceMemberProfile
} from '../types';
import { api } from '../services/api';
import { socket } from '../services/socket';

// ========== ONLINE USER MAP ENTRY ==========
interface OnlineUser {
  userId: string;
  userName: string;
  userAvatar: string;
  userColor: string;
  status: string;
}

interface RemoteCursor {
  userId: string;
  userName: string;
  userColor: string;
  rowIndex: number;
  cellIndex: number;
}

// ========== STATE ==========
interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentPage: Page;
  currentWorkspaceId: string | null;
  currentDocumentId: string | null;
  workspaces: Workspace[];
  documents: FinancialDocument[];
  chatMessages: ChatMessage[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  users: User[];
  workspaceMembers: WorkspaceMemberProfile[];
  onlineUsers: Map<string, OnlineUser>;
  typingUsers: Map<string, Set<string>>;
  documentEditors: Map<string, Set<string>>;
  remoteCursors: Map<string, RemoteCursor>;
  sidebarOpen: boolean;
  chatOpen: boolean;
  isConnected: boolean;
  hasOnboarded: boolean;
}

// ========== ACTIONS ==========
type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User } }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'NAVIGATE'; payload: Page }
  | { type: 'SET_WORKSPACE'; payload: string | null }
  | { type: 'SET_DOCUMENT'; payload: string | null }
  | { type: 'SET_WORKSPACES'; payload: Workspace[] }
  | { type: 'ADD_WORKSPACE'; payload: Workspace }
  | { type: 'UPDATE_WORKSPACE'; payload: Workspace }
  | { type: 'SET_DOCUMENTS'; payload: FinancialDocument[] }
  | { type: 'ADD_DOCUMENT'; payload: FinancialDocument }
  | { type: 'UPDATE_DOCUMENT'; payload: FinancialDocument }
  | { type: 'UPDATE_CELL'; payload: { docId: string; rowIndex: number; cellIndex: number; value: string; userId?: string } }
  | { type: 'ADD_ROW'; payload: { docId: string; row: SpreadsheetRow; afterRowIndex?: number } }
  | { type: 'DELETE_ROW'; payload: { docId: string; rowIndex: number } }
  | { type: 'SET_CHAT_MESSAGES'; payload: ChatMessage[] }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_AUDIT_LOGS'; payload: AuditLog[] }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLog }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_WORKSPACE_MEMBERS'; payload: WorkspaceMemberProfile[] }
  | { type: 'USER_ONLINE'; payload: OnlineUser }
  | { type: 'USER_OFFLINE'; payload: string }
  | { type: 'SET_WORKSPACE_PRESENCE'; payload: { workspaceId: string; users: OnlineUser[] } }
  | { type: 'USER_TYPING'; payload: { workspaceId: string; userId: string } }
  | { type: 'USER_STOPPED_TYPING'; payload: { workspaceId: string; userId: string } }
  | { type: 'SET_DOCUMENT_EDITORS'; payload: { documentId: string; users: any[] } }
  | { type: 'CURSOR_MOVED'; payload: RemoteCursor & { documentId: string } }
  | { type: 'CURSOR_REMOVED'; payload: { documentId: string; userId: string } }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'SET_CHAT_OPEN'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_ONBOARDED' };

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  currentPage: 'landing',
  currentWorkspaceId: null,
  currentDocumentId: null,
  workspaces: [],
  documents: [],
  chatMessages: [],
  auditLogs: [],
  notifications: [],
  users: [],
  workspaceMembers: [],
  onlineUsers: new Map(),
  typingUsers: new Map(),
  documentEditors: new Map(),
  remoteCursors: new Map(),
  sidebarOpen: true,
  chatOpen: false,
  isConnected: false,
  hasOnboarded: false,
};

// ========== REDUCER ==========
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN_SUCCESS':
      return { ...state, user: action.payload.user, isAuthenticated: true, currentPage: 'dashboard', isLoading: false };
    case 'UPDATE_USER':
      return { ...state, user: action.payload };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
        currentPage: 'landing',
        onlineUsers: new Map(),
        typingUsers: new Map(),
        documentEditors: new Map(),
        remoteCursors: new Map(),
      };
    case 'NAVIGATE':
      return { ...state, currentPage: action.payload };
    case 'SET_WORKSPACE':
      return { ...state, currentWorkspaceId: action.payload, currentDocumentId: null };
    case 'SET_DOCUMENT':
      return { ...state, currentDocumentId: action.payload };
    case 'SET_WORKSPACES':
      return { ...state, workspaces: action.payload };
    case 'ADD_WORKSPACE':
      return { ...state, workspaces: [...state.workspaces, action.payload] };
    case 'UPDATE_WORKSPACE':
      return { ...state, workspaces: state.workspaces.map(w => w.id === action.payload.id ? action.payload : w) };
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload };
    case 'ADD_DOCUMENT':
      return { ...state, documents: [...state.documents, action.payload] };
    case 'UPDATE_DOCUMENT':
      return { ...state, documents: state.documents.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'UPDATE_CELL': {
      const docs = state.documents.map(doc => {
        if (doc.id !== action.payload.docId) return doc;
        const newRows = doc.rows.map((row, ri) => {
          if (ri !== action.payload.rowIndex) return row;
          const newCells = row.cells.map((cell, ci) => {
            if (ci !== action.payload.cellIndex) return cell;
            return { ...cell, value: action.payload.value };
          });
          return { ...row, cells: newCells };
        });
        return { ...doc, rows: newRows, updatedAt: new Date().toISOString() };
      });
      return { ...state, documents: docs };
    }
    case 'ADD_ROW': {
      const docs = state.documents.map(doc => {
        if (doc.id !== action.payload.docId) return doc;
        const newRows = [...doc.rows];
        const insertIndex = action.payload.afterRowIndex !== undefined
          ? action.payload.afterRowIndex + 1
          : newRows.length;
        newRows.splice(insertIndex, 0, action.payload.row);
        return { ...doc, rows: newRows, updatedAt: new Date().toISOString() };
      });
      return { ...state, documents: docs };
    }
    case 'DELETE_ROW': {
      const docs = state.documents.map(doc => {
        if (doc.id !== action.payload.docId) return doc;
        return {
          ...doc,
          rows: doc.rows.filter((_, i) => i !== action.payload.rowIndex),
          updatedAt: new Date().toISOString(),
        };
      });
      return { ...state, documents: docs };
    }
    case 'SET_CHAT_MESSAGES':
      return { ...state, chatMessages: action.payload };
    case 'ADD_CHAT_MESSAGE':
      // Deduplicate by id
      if (state.chatMessages.some(m => m.id === action.payload.id)) return state;
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'SET_AUDIT_LOGS':
      return { ...state, auditLogs: action.payload };
    case 'ADD_AUDIT_LOG':
      return { ...state, auditLogs: [action.payload, ...state.auditLogs] };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) };
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_WORKSPACE_MEMBERS':
      return { ...state, workspaceMembers: action.payload };
    case 'USER_ONLINE': {
      const m = new Map(state.onlineUsers);
      m.set(action.payload.userId, action.payload);
      return { ...state, onlineUsers: m };
    }
    case 'USER_OFFLINE': {
      const m = new Map(state.onlineUsers);
      m.delete(action.payload);
      return { ...state, onlineUsers: m };
    }
    case 'SET_WORKSPACE_PRESENCE': {
      const m = new Map(state.onlineUsers);
      action.payload.users.forEach(u => m.set(u.userId, u));
      return { ...state, onlineUsers: m };
    }
    case 'USER_TYPING': {
      const m = new Map(state.typingUsers);
      const existing = m.get(action.payload.workspaceId) || new Set();
      existing.add(action.payload.userId);
      m.set(action.payload.workspaceId, existing);
      return { ...state, typingUsers: m };
    }
    case 'USER_STOPPED_TYPING': {
      const m = new Map(state.typingUsers);
      const existing = m.get(action.payload.workspaceId);
      if (existing) {
        existing.delete(action.payload.userId);
        if (existing.size === 0) m.delete(action.payload.workspaceId);
        else m.set(action.payload.workspaceId, existing);
      }
      return { ...state, typingUsers: m };
    }
    case 'SET_DOCUMENT_EDITORS': {
      const m = new Map(state.documentEditors);
      m.set(action.payload.documentId, new Set(action.payload.users.map((u: any) => u.userId || u.odId)));
      return { ...state, documentEditors: m };
    }
    case 'CURSOR_MOVED': {
      const m = new Map(state.remoteCursors);
      m.set(`${action.payload.documentId}:${action.payload.userId}`, {
        userId: action.payload.userId,
        userName: action.payload.userName,
        userColor: action.payload.userColor,
        rowIndex: action.payload.rowIndex,
        cellIndex: action.payload.cellIndex,
      });
      return { ...state, remoteCursors: m };
    }
    case 'CURSOR_REMOVED': {
      const m = new Map(state.remoteCursors);
      m.delete(`${action.payload.documentId}:${action.payload.userId}`);
      return { ...state, remoteCursors: m };
    }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_CHAT':
      return { ...state, chatOpen: !state.chatOpen };
    case 'SET_CHAT_OPEN':
      return { ...state, chatOpen: action.payload };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_ONBOARDED':
      return { ...state, hasOnboarded: true };
    default:
      return state;
  }
}

// ========== CONTEXT TYPE ==========
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role?: string) => Promise<boolean>;
  logout: () => void;
  navigate: (page: Page) => void;
  openWorkspace: (id: string) => void;
  closeWorkspace: () => void;
  openDocument: (id: string) => void;
  closeDocument: () => void;
  updateCell: (docId: string, rowIndex: number, cellIndex: number, value: string) => void;
  addRow: (docId: string, afterRowIndex?: number) => void;
  deleteRow: (docId: string, rowIndex: number) => void;
  sendMessage: (content: string) => void;
  moveCursor: (docId: string, rowIndex: number, cellIndex: number) => void;
  startTyping: () => void;
  stopTyping: () => void;
  createDocument: (title: string, type: FinancialDocument['type']) => Promise<void>;
  createWorkspace: (name: string, description: string) => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  fetchDocuments: (workspaceId: string) => Promise<void>;
  fetchMessages: (workspaceId: string) => Promise<void>;
  fetchAuditLogs: (workspaceId: string) => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<{ success: boolean; message?: string }>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean; message?: string }>;
  getOnlineUsers: () => User[];
  getTypingUsers: (workspaceId: string) => User[];
  getRemoteCursors: (documentId: string) => RemoteCursor[];
  getMemberProfile: (userId: string) => WorkspaceMemberProfile | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ========== INIT: CHECK AUTH ==========
  useEffect(() => {
    const checkAuth = async () => {
      if (!api.isAuthenticated()) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      try {
        const response = await api.getMe();
        if (response.success && response.data?.user) {
          dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.data.user } });
          socket.connect();
        } else {
          api.clearTokens();
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    checkAuth();
  }, []);

  // ========== SOCKET EVENT LISTENERS ==========
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(socket.on('connect', () => dispatch({ type: 'SET_CONNECTED', payload: true })));
    unsubscribers.push(socket.on('disconnect', () => dispatch({ type: 'SET_CONNECTED', payload: false })));

    unsubscribers.push(
      socket.on('user-joined', (data: any) => {
        if (!data.user) return;
        dispatch({
          type: 'USER_ONLINE',
          payload: {
            userId: data.user.id || data.userId,
            userName: data.user.name,
            userAvatar: data.user.avatar,
            userColor: data.user.color,
            status: 'online',
          },
        });
      })
    );

    unsubscribers.push(
      socket.on('user-left', (data: any) => {
        const userId = data.userId;
        dispatch({ type: 'USER_OFFLINE', payload: userId });
        if (state.currentDocumentId) {
          dispatch({ type: 'CURSOR_REMOVED', payload: { documentId: state.currentDocumentId, userId } });
        }
      })
    );

    unsubscribers.push(
      socket.on('workspace-presence', (data: any) => {
        // data.users uses userId/userName/userAvatar/userColor
        const users: OnlineUser[] = (data.users || []).map((u: any) => ({
          userId: u.userId,
          userName: u.userName,
          userAvatar: u.userAvatar,
          userColor: u.userColor,
          status: u.status || 'online',
        }));
        dispatch({ type: 'SET_WORKSPACE_PRESENCE', payload: { workspaceId: data.workspaceId, users } });
      })
    );

    unsubscribers.push(
      socket.on('document-presence', (data: any) => {
        dispatch({ type: 'SET_DOCUMENT_EDITORS', payload: { documentId: data.documentId, users: data.users || [] } });
      })
    );

    unsubscribers.push(
      socket.on('cell-updated', (data: any) => {
        dispatch({
          type: 'UPDATE_CELL',
          payload: {
            docId: data.documentId,
            rowIndex: data.rowIndex,
            cellIndex: data.cellIndex,
            value: data.value,
            userId: data.userId,
          },
        });
      })
    );

    unsubscribers.push(
      socket.on('row-added', (data: any) => {
        dispatch({
          type: 'ADD_ROW',
          payload: { docId: data.documentId, row: data.row, afterRowIndex: data.afterRowIndex },
        });
      })
    );

    unsubscribers.push(
      socket.on('row-deleted', (data: any) => {
        dispatch({ type: 'DELETE_ROW', payload: { docId: data.documentId, rowIndex: data.rowIndex } });
      })
    );

    unsubscribers.push(
      socket.on('cursor-moved', (data: any) => {
        if (data.userId !== state.user?.id) {
          dispatch({
            type: 'CURSOR_MOVED',
            payload: {
              documentId: data.documentId,
              userId: data.userId,
              userName: data.user?.name || 'Unknown',
              userColor: data.user?.color || '#888',
              rowIndex: data.rowIndex,
              cellIndex: data.cellIndex,
            },
          });
        }
      })
    );

    unsubscribers.push(
      socket.on('new-message', (message: any) => {
        // Normalize message fields
        const normalized: ChatMessage = {
          id: message.id,
          workspaceId: message.workspaceId,
          userId: message.userId,
          userName: message.user?.name || message.userName || 'Unknown',
          userAvatar: message.user?.avatar || message.userAvatar || '',
          content: message.content,
          timestamp: message.createdAt || message.timestamp || new Date().toISOString(),
          type: message.type || 'message',
        };
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: normalized });
      })
    );

    unsubscribers.push(
      socket.on('user-typing', (data: any) => {
        if (data.userId !== state.user?.id) {
          dispatch({ type: 'USER_TYPING', payload: { workspaceId: data.workspaceId, userId: data.userId } });
        }
      })
    );

    unsubscribers.push(
      socket.on('user-stopped-typing', (data: any) => {
        dispatch({ type: 'USER_STOPPED_TYPING', payload: { workspaceId: data.workspaceId, userId: data.userId } });
      })
    );

    unsubscribers.push(
      socket.on('notification', (notification: any) => {
        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [state.isAuthenticated, state.user?.id, state.currentDocumentId]);

  // ========== AUTH ACTIONS ==========
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await api.login({ email, password });
      if (response.success && response.data) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.data.user } });
        socket.connect();
        return true;
      }
      dispatch({ type: 'SET_LOADING', payload: false });
      return false;
    } catch {
      dispatch({ type: 'SET_LOADING', payload: false });
      return false;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role?: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await api.register({ name, email, password, role: role as any });
      if (response.success && response.data) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user: response.data.user } });
        socket.connect();
        return true;
      }
      dispatch({ type: 'SET_LOADING', payload: false });
      return false;
    } catch {
      dispatch({ type: 'SET_LOADING', payload: false });
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    socket.disconnect();
    dispatch({ type: 'LOGOUT' });
  }, []);

  // ========== NAVIGATION ==========
  const navigate = useCallback((page: Page) => {
    dispatch({ type: 'NAVIGATE', payload: page });
  }, []);

  const openWorkspace = useCallback(async (id: string) => {
    dispatch({ type: 'SET_WORKSPACE', payload: id });
    dispatch({ type: 'NAVIGATE', payload: 'workspace' });
    socket.joinWorkspace(id);

    try {
      const [docsRes, messagesRes, auditRes, membersRes] = await Promise.all([
        api.getDocuments(id),
        api.getMessages(id),
        api.getAuditLogs(id),
        api.getWorkspaceMembers(id),
      ]);
      if (docsRes.success && docsRes.data) dispatch({ type: 'SET_DOCUMENTS', payload: docsRes.data });
      if (messagesRes.success && messagesRes.data) dispatch({ type: 'SET_CHAT_MESSAGES', payload: messagesRes.data });
      if (auditRes.success && auditRes.data) dispatch({ type: 'SET_AUDIT_LOGS', payload: auditRes.data });
      if (membersRes.success && membersRes.data) {
        dispatch({ type: 'SET_WORKSPACE_MEMBERS', payload: membersRes.data });
        // Also populate users list from member profiles
        const usersFromMembers: User[] = membersRes.data.map(m => ({
          id: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          avatar: m.avatar,
          color: m.color,
        }));
        dispatch({ type: 'SET_USERS', payload: usersFromMembers });
      }
    } catch (error) {
      console.error('Failed to load workspace data:', error);
    }
  }, []);

  const closeWorkspace = useCallback(() => {
    if (state.currentWorkspaceId) socket.leaveWorkspace(state.currentWorkspaceId);
    dispatch({ type: 'SET_WORKSPACE', payload: null });
  }, [state.currentWorkspaceId]);

  const openDocument = useCallback(async (id: string) => {
    dispatch({ type: 'SET_DOCUMENT', payload: id });
    dispatch({ type: 'NAVIGATE', payload: 'document' });
    socket.joinDocument(id);

    try {
      const response = await api.getDocument(id);
      if (response.success && response.data) {
        dispatch({ type: 'UPDATE_DOCUMENT', payload: response.data });
      }
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  }, []);

  const closeDocument = useCallback(() => {
    if (state.currentDocumentId) socket.leaveDocument(state.currentDocumentId);
    dispatch({ type: 'SET_DOCUMENT', payload: null });
  }, [state.currentDocumentId]);

  // ========== DOCUMENT OPS ==========
  const updateCell = useCallback((docId: string, rowIndex: number, cellIndex: number, value: string) => {
    dispatch({ type: 'UPDATE_CELL', payload: { docId, rowIndex, cellIndex, value } });
    socket.updateCell(docId, rowIndex, cellIndex, value);
  }, []);

  const addRow = useCallback((docId: string, afterRowIndex?: number) => {
    socket.addRow(docId, afterRowIndex);
    api.addRow(docId, afterRowIndex).catch(console.error);
  }, []);

  const deleteRow = useCallback((docId: string, rowIndex: number) => {
    dispatch({ type: 'DELETE_ROW', payload: { docId, rowIndex } });
    socket.deleteRow(docId, rowIndex);
  }, []);

  const moveCursor = useCallback((docId: string, rowIndex: number, cellIndex: number) => {
    socket.moveCursor(docId, rowIndex, cellIndex);
  }, []);

  // ========== CHAT — send via socket, not REST ==========
  const sendMessage = useCallback((content: string) => {
    if (!state.user || !state.currentWorkspaceId) return;
    socket.sendMessage(state.currentWorkspaceId, content);
  }, [state.user, state.currentWorkspaceId]);

  const startTyping = useCallback(() => {
    if (state.currentWorkspaceId) socket.startTyping(state.currentWorkspaceId);
  }, [state.currentWorkspaceId]);

  const stopTyping = useCallback(() => {
    if (state.currentWorkspaceId) socket.stopTyping(state.currentWorkspaceId);
  }, [state.currentWorkspaceId]);

  // ========== CRUD ==========
  const createDocument = useCallback(async (title: string, type: FinancialDocument['type']) => {
    if (!state.currentWorkspaceId) return;
    const response = await api.createDocument({ title, type, workspaceId: state.currentWorkspaceId });
    if (response.success && response.data) {
      dispatch({ type: 'ADD_DOCUMENT', payload: response.data });
      dispatch({ type: 'SET_DOCUMENT', payload: response.data.id });
      dispatch({ type: 'NAVIGATE', payload: 'document' });
      socket.joinDocument(response.data.id);
    }
  }, [state.currentWorkspaceId]);

  const createWorkspace = useCallback(async (name: string, description: string) => {
    const response = await api.createWorkspace({ name, description });
    if (response.success && response.data) {
      dispatch({ type: 'ADD_WORKSPACE', payload: response.data });
      openWorkspace(response.data.id);
    }
  }, [openWorkspace]);

  const fetchWorkspaces = useCallback(async () => {
    const response = await api.getWorkspaces();
    if (response.success && response.data) {
      dispatch({ type: 'SET_WORKSPACES', payload: response.data });
    }
  }, []);

  const fetchDocuments = useCallback(async (workspaceId: string) => {
    const response = await api.getDocuments(workspaceId);
    if (response.success && response.data) {
      dispatch({ type: 'SET_DOCUMENTS', payload: response.data });
    }
  }, []);

  const fetchMessages = useCallback(async (workspaceId: string) => {
    const response = await api.getMessages(workspaceId);
    if (response.success && response.data) {
      dispatch({ type: 'SET_CHAT_MESSAGES', payload: response.data });
    }
  }, []);

  const fetchAuditLogs = useCallback(async (workspaceId: string) => {
    const response = await api.getAuditLogs(workspaceId);
    if (response.success && response.data) {
      dispatch({ type: 'SET_AUDIT_LOGS', payload: response.data });
    }
  }, []);

  const updateProfile = useCallback(
    async (data: { name?: string; email?: string }) => {
      const response = await api.updateProfile(data);
      if (response.success && response.data?.user) {
        dispatch({ type: 'UPDATE_USER', payload: response.data.user });
        return { success: true };
      }
      return { success: false, message: response.error?.message || 'Failed to update profile' };
    },
    []
  );

  const changePassword = useCallback(
    async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.changePassword(data);
      if (response.success) return { success: true };
      return { success: false, message: response.error?.message || 'Failed to update password' };
    },
    []
  );

  // ========== PRESENCE / LOOKUP HELPERS ==========
  const getMemberProfile = useCallback((userId: string): WorkspaceMemberProfile | undefined => {
    return state.workspaceMembers.find(m => m.userId === userId);
  }, [state.workspaceMembers]);

  const getOnlineUsers = useCallback((): User[] => {
    return Array.from(state.onlineUsers.values()).map(u => ({
      id: u.userId,
      name: u.userName,
      avatar: u.userAvatar,
      color: u.userColor,
      email: '',
      role: 'viewer' as const,
    }));
  }, [state.onlineUsers]);

  const getTypingUsers = useCallback((workspaceId: string): User[] => {
    const typingIds = state.typingUsers.get(workspaceId) || new Set();
    return Array.from(typingIds)
      .filter(id => id !== state.user?.id)
      .map(id => {
        const online = state.onlineUsers.get(id);
        const member = state.workspaceMembers.find(m => m.userId === id);
        if (online) {
          return {
            id: online.userId,
            name: online.userName,
            avatar: online.userAvatar,
            color: online.userColor,
            email: '',
            role: 'viewer' as const,
          };
        }
        if (member) {
          return {
            id: member.userId,
            name: member.name,
            avatar: member.avatar,
            color: member.color,
            email: member.email,
            role: member.role,
          };
        }
        return null;
      })
      .filter(Boolean) as User[];
  }, [state.typingUsers, state.onlineUsers, state.user?.id, state.workspaceMembers]);

  const getRemoteCursors = useCallback((documentId: string): RemoteCursor[] => {
    return Array.from(state.remoteCursors.entries())
      .filter(([key]) => key.startsWith(`${documentId}:`))
      .map(([, cursor]) => cursor);
  }, [state.remoteCursors]);

  return (
    <AppContext.Provider value={{
      state, dispatch, login, register, logout, navigate,
      openWorkspace, closeWorkspace, openDocument, closeDocument,
      updateCell, addRow, deleteRow, sendMessage, moveCursor,
      startTyping, stopTyping, createDocument, createWorkspace,
      fetchWorkspaces, fetchDocuments, fetchMessages, fetchAuditLogs,
      updateProfile, changePassword,
      getOnlineUsers, getTypingUsers, getRemoteCursors, getMemberProfile,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
