import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

type ValidationType = 'body' | 'query' | 'params';

export function validate<T extends ZodSchema>(
  schema: T,
  type: ValidationType = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[type];
      const result = schema.parse(data);
      req[type] = result;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Common validation schemas
export const schemas = {
  // Auth
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),

  register: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email format'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    role: z.enum(['admin', 'finance_manager', 'viewer']).optional(),
  }),

  updateProfile: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
    email: z.string().email('Invalid email format').optional(),
  }).refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'Provide a name or email to update',
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),

  // Workspace
  createWorkspace: z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
  }),

  updateWorkspace: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    settings: z.object({
      allowViewerComments: z.boolean().optional(),
      requireApprovalForChanges: z.boolean().optional(),
      autoSaveInterval: z.number().min(5).max(300).optional(),
    }).optional(),
  }),

  inviteMember: z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'finance_manager', 'viewer']),
  }),

  // Document
  createDocument: z.object({
    title: z.string().min(1).max(200),
    type: z.enum(['budget', 'expense', 'forecast', 'report']),
    workspaceId: z.string().min(1),
  }),

  updateDocument: z.object({
    title: z.string().min(1).max(200).optional(),
  }),

  updateCell: z.object({
    rowIndex: z.number().min(0),
    cellIndex: z.number().min(0),
    value: z.string(),
    clientVersion: z.number().min(0).optional(),
  }),

  // Chat
  sendMessage: z.object({
    content: z.string().min(1).max(5000),
    replyTo: z.string().optional(),
  }),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  // ObjectId param
  objectId: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format'),
  }),
};
