import mongoose, { Schema, Document } from 'mongoose';
import type { Notification as INotification, NotificationType } from '@shared/types/index.js';

export interface NotificationDocument extends Omit<INotification, 'id'>, Document {}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'document_update', 'document_comment', 'mention',
        'workspace_invite', 'member_joined', 'member_left',
        'budget_alert', 'version_saved', 'system'
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
    expiresAt: String,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        ret.createdAt = ret.createdAt?.toISOString?.() || ret.createdAt;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// TTL index - auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = mongoose.model<NotificationDocument>('Notification', notificationSchema);

export default Notification;
