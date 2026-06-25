import mongoose, { Schema, Document } from 'mongoose';
import type { Workspace as IWorkspace, WorkspaceMember, WorkspaceSettings } from '@shared/types/index.js';

export interface WorkspaceDocument extends Omit<IWorkspace, 'id'>, Document {}

const workspaceMemberSchema = new Schema<WorkspaceMember>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    role: {
      type: String,
      enum: ['admin', 'finance_manager', 'viewer'],
      default: 'viewer',
    },
    joinedAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  { _id: false }
);

const workspaceSettingsSchema = new Schema<WorkspaceSettings>(
  {
    allowViewerComments: {
      type: Boolean,
      default: true,
    },
    requireApprovalForChanges: {
      type: Boolean,
      default: false,
    },
    autoSaveInterval: {
      type: Number,
      default: 30, // seconds
    },
  },
  { _id: false }
);

const workspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    ownerId: {
      type: String,
      required: true,
      ref: 'User',
    },
    members: {
      type: [workspaceMemberSchema],
      default: [],
    },
    settings: {
      type: workspaceSettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
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

// Indexes
workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ 'members.userId': 1 });

// Auto-add owner as admin member on create
workspaceSchema.pre('save', function(next) {
  if (this.isNew) {
    const ownerExists = this.members.some((m: any) => m.userId === this.ownerId);
    if (!ownerExists) {
      this.members.push({
        userId: this.ownerId,
        role: 'admin',
        joinedAt: new Date().toISOString(),
      });
    }
  }
  next();
});

export const Workspace = mongoose.model<WorkspaceDocument>('Workspace', workspaceSchema);

export default Workspace;
