// ============================================
// SHARED TYPES - Used by both client and server
// ============================================

// User & Auth Types
export type UserRole = 'admin' | 'finance_manager' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  color: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: AuthTokens;
}

// Workspace Types
export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  userId: string;
  role: UserRole;
  joinedAt: string;
}

export interface WorkspaceSettings {
  allowViewerComments: boolean;
  requireApprovalForChanges: boolean;
  autoSaveInterval: number; // in seconds
}

export interface CreateWorkspaceRequest {
  name: string;
  description: string;
}

export interface InviteMemberRequest {
  email: string;
  role: UserRole;
}

// Document Types
export type DocumentType = 'budget' | 'expense' | 'forecast' | 'report';

export interface FinancialDocument {
  id: string;
  workspaceId: string;
  title: string;
  type: DocumentType;
  rows: SpreadsheetRow[];
  versions: DocumentVersion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lockedBy?: string;
  lockedAt?: string;
}

export interface SpreadsheetRow {
  id: string;
  order: number;
  cells: SpreadsheetCell[];
}

export interface SpreadsheetCell {
  id: string;
  columnIndex: number;
  value: string;
  type: CellType;
  formula?: string;
  format?: CellFormat;
}

export type CellType = 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'formula';

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  alignment?: 'left' | 'center' | 'right';
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  snapshot: SpreadsheetRow[];
  changes: ChangeRecord[];
  createdBy: string;
  createdAt: string;
  message?: string;
}

export interface ChangeRecord {
  id: string;
  userId: string;
  action: 'create' | 'update' | 'delete';
  rowId?: string;
  cellId?: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface CreateDocumentRequest {
  title: string;
  type: DocumentType;
  workspaceId: string;
}

export interface UpdateCellRequest {
  documentId: string;
  rowIndex: number;
  cellIndex: number;
  value: string;
  clientVersion: number;
}

// Chat Types
export interface ChatMessage {
  id: string;
  workspaceId: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  type: 'message' | 'system' | 'notification';
  replyTo?: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  deleted?: boolean;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'document_link';
  url: string;
  name: string;
  size?: number;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface SendMessageRequest {
  workspaceId: string;
  content: string;
  replyTo?: string;
}

// Audit Types
export interface AuditLog {
  id: string;
  workspaceId: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  documentTitle?: string;
  documentId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export type AuditAction = 
  | 'create' | 'update' | 'delete' | 'view'
  | 'login' | 'logout' | 'invite' | 'remove'
  | 'lock' | 'unlock' | 'export' | 'import';

export type AuditResource = 
  | 'user' | 'workspace' | 'document' | 'cell' | 'row'
  | 'chat_message' | 'member' | 'version';

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
  timestamp?: string;
}

export type NotificationType = 
  | 'document_update' | 'document_comment' | 'mention'
  | 'workspace_invite' | 'member_joined' | 'member_left'
  | 'budget_alert' | 'version_saved' | 'system';

// WebSocket Event Types
export interface SocketEvents {
  // Client -> Server
  'join-workspace': { workspaceId: string };
  'leave-workspace': { workspaceId: string };
  'join-document': { documentId: string };
  'leave-document': { documentId: string };
  'cell-update': UpdateCellRequest;
  'row-add': { documentId: string; afterRowIndex?: number };
  'row-delete': { documentId: string; rowIndex: number };
  'cursor-move': { documentId: string; rowIndex: number; cellIndex: number };
  'typing-start': { workspaceId: string };
  'typing-stop': { workspaceId: string };
  'send-message': SendMessageRequest;
  
  // Server -> Client
  'user-joined': { userId: string; user: UserPublic };
  'user-left': { userId: string };
  'cell-updated': { documentId: string; rowIndex: number; cellIndex: number; value: string; userId: string };
  'row-added': { documentId: string; row: SpreadsheetRow; afterRowIndex?: number; userId: string };
  'row-deleted': { documentId: string; rowIndex: number; userId: string };
  'cursor-moved': { documentId: string; userId: string; rowIndex: number; cellIndex: number };
  'user-typing': { workspaceId: string; userId: string };
  'user-stopped-typing': { workspaceId: string; userId: string };
  'new-message': ChatMessage & { user: UserPublic };
  'document-locked': { documentId: string; userId: string };
  'document-unlocked': { documentId: string };
  'conflict-detected': { documentId: string; cellId: string; serverValue: string; clientValue: string };
  'version-saved': { documentId: string; version: DocumentVersion };
  'notification': Notification;
  'error': { code: string; message: string };
}

// Presence Types
export interface UserPresence {
  odId: string;
  odName: string;
  odAvatar: string;
  odColor: string;
  workspaceId?: string;
  documentId?: string;
  cursor?: CursorPosition;
  status: 'online' | 'away' | 'busy';
  lastSeen: string;
}

export interface CursorPosition {
  rowIndex: number;
  cellIndex: number;
  isSelecting?: boolean;
  selectionEnd?: { rowIndex: number; cellIndex: number };
}

// Analytics Types
export interface FinancialInsight {
  id: string;
  workspaceId: string;
  type: InsightType;
  title: string;
  value: number;
  previousValue?: number;
  change?: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  period: string;
  calculatedAt: string;
}

export type InsightType = 
  | 'total_revenue' | 'total_expenses' | 'net_profit'
  | 'burn_rate' | 'runway' | 'budget_utilization';

export interface BudgetCategory {
  name: string;
  allocated: number;
  spent: number;
  remaining: number;
  utilizationPercent: number;
  color: string;
}

export interface MonthlyFinancials {
  month: string;
  year: number;
  income: number;
  expenses: number;
  profit: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WorkspaceMemberProfile {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  color: string;
  joinedAt: string;
}

export type Page = 'landing' | 'login' | 'register' | 'dashboard' | 'workspace' | 'document' | 'analytics' | 'settings' | 'audit';
