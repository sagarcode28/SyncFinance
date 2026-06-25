// Real API Service - connects to actual backend only
// No mock data - all operations require a running backend

import type {
  User, Workspace, FinancialDocument, ChatMessage, AuditLog,
  Notification, AuthTokens, LoginRequest, RegisterRequest,
  CreateWorkspaceRequest, CreateDocumentRequest, ApiResponse,
  WorkspaceMemberProfile
} from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('sf_accessToken');
    this.refreshToken = localStorage.getItem('sf_refreshToken');
  }

  setTokens(tokens: AuthTokens) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    localStorage.setItem('sf_accessToken', tokens.accessToken);
    localStorage.setItem('sf_refreshToken', tokens.refreshToken);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('sf_accessToken');
    localStorage.removeItem('sf_refreshToken');
  }

  getAccessToken() {
    return this.accessToken;
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      // Handle token expiration - try refresh
      if (response.status === 401 && data.error?.code === 'TOKEN_EXPIRED') {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          return this.request<T>(endpoint, options);
        }
        this.clearTokens();
        return {
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'Session expired. Please sign in again.' },
        };
      }

      // Handle auth errors
      if (response.status === 401) {
        return {
          success: false,
          error: data.error || { code: 'UNAUTHORIZED', message: 'Authentication required' },
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          error: data.error || { code: 'FORBIDDEN', message: 'Access denied' },
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          error: data.error || { code: 'NOT_FOUND', message: 'Resource not found' },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || { code: 'SERVER_ERROR', message: 'Something went wrong' },
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', endpoint, error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to server. Please check your connection.',
        },
      };
    }
  }

  private async refreshTokens(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.data?.tokens) {
        this.setTokens(data.data.tokens);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // ========== AUTH ==========
  async login(data: LoginRequest) {
    const response = await this.request<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      this.setTokens(response.data.tokens);
    }

    return response;
  }

  async register(data: RegisterRequest) {
    const response = await this.request<{ user: User; tokens: AuthTokens }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      this.setTokens(response.data.tokens);
    }

    return response;
  }

  async logout() {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
    this.clearTokens();
  }

  async getMe() {
    return this.request<{ user: User }>('/auth/me');
  }

  async updateProfile(data: { name?: string; email?: string }) {
    return this.request<{ user: User }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========== WORKSPACES ==========
  async getWorkspaces(page = 1, limit = 50) {
    return this.request<Workspace[]>(`/workspaces?page=${page}&limit=${limit}`);
  }

  async getWorkspace(id: string) {
    return this.request<Workspace>(`/workspaces/${id}`);
  }

  async createWorkspace(data: CreateWorkspaceRequest) {
    return this.request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkspace(id: string, data: Partial<CreateWorkspaceRequest>) {
    return this.request<Workspace>(`/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkspace(id: string) {
    return this.request(`/workspaces/${id}`, { method: 'DELETE' });
  }

  async inviteMember(workspaceId: string, email: string, role: string) {
    return this.request(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async removeMember(workspaceId: string, memberId: string) {
    return this.request(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async getWorkspaceMembers(workspaceId: string) {
    return this.request<WorkspaceMemberProfile[]>(`/workspaces/${workspaceId}/members`);
  }

  // ========== DOCUMENTS ==========
  async getDocuments(workspaceId: string, page = 1, limit = 50) {
    return this.request<FinancialDocument[]>(
      `/documents/workspace/${workspaceId}?page=${page}&limit=${limit}`
    );
  }

  async getDocument(id: string) {
    return this.request<FinancialDocument>(`/documents/${id}`);
  }

  async createDocument(data: CreateDocumentRequest) {
    return this.request<FinancialDocument>('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCell(docId: string, rowIndex: number, cellIndex: number, value: string) {
    return this.request(`/documents/${docId}/cells`, {
      method: 'PATCH',
      body: JSON.stringify({ rowIndex, cellIndex, value }),
    });
  }

  async addRow(docId: string, afterRowIndex?: number) {
    return this.request(`/documents/${docId}/rows`, {
      method: 'POST',
      body: JSON.stringify({ afterRowIndex }),
    });
  }

  async deleteRow(docId: string, rowIndex: number) {
    return this.request(`/documents/${docId}/rows`, {
      method: 'DELETE',
      body: JSON.stringify({ rowIndex }),
    });
  }

  async saveVersion(docId: string, message?: string) {
    return this.request(`/documents/${docId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async deleteDocument(id: string) {
    return this.request(`/documents/${id}`, { method: 'DELETE' });
  }

  // ========== CHAT ==========
  async getMessages(workspaceId: string, page = 1, limit = 50) {
    return this.request<ChatMessage[]>(
      `/chat/workspace/${workspaceId}?page=${page}&limit=${limit}`
    );
  }

  async sendMessage(workspaceId: string, content: string, replyTo?: string) {
    return this.request<ChatMessage>(`/chat/workspace/${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify({ content, replyTo }),
    });
  }

  // ========== AUDIT ==========
  async getAuditLogs(workspaceId: string, page = 1, limit = 50) {
    return this.request<AuditLog[]>(
      `/audit/workspace/${workspaceId}?page=${page}&limit=${limit}`
    );
  }

  // ========== NOTIFICATIONS ==========
  async getNotifications(page = 1, limit = 20, unreadOnly = false) {
    return this.request<Notification[]>(
      `/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`
    );
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PATCH' });
  }
}

export const api = new ApiService();
export default api;
