import mongoose, { Schema, Document } from 'mongoose';
import type { AuditLog as IAuditLog, AuditAction, AuditResource } from '@shared/types/index.js';

export interface AuditLogDocument extends Omit<IAuditLog, 'id'>, Document {}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    workspaceId: {
      type: String,
      required: true,
      ref: 'Workspace',
      index: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'view', 'login', 'logout', 'invite', 'remove', 'lock', 'unlock', 'export', 'import'],
      required: true,
    },
    resource: {
      type: String,
      enum: ['user', 'workspace', 'document', 'cell', 'row', 'chat_message', 'member', 'version'],
      required: true,
    },
    resourceId: String,
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for efficient queries
auditLogSchema.index({ workspaceId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, workspaceId: 1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

// TTL index - auto-delete after 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);

export default AuditLog;
