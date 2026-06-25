import mongoose, { Schema, Document } from 'mongoose';
import type { ChatMessage as IChatMessage, Attachment, Reaction } from '@shared/types/index.js';

export interface ChatMessageDocument extends Omit<IChatMessage, 'id'>, Document {}

const attachmentSchema = new Schema<Attachment>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['image', 'file', 'document_link'],
      required: true,
    },
    url: { type: String, required: true },
    name: { type: String, required: true },
    size: Number,
  },
  { _id: false }
);

const reactionSchema = new Schema<Reaction>(
  {
    emoji: { type: String, required: true },
    userIds: { type: [String], default: [] },
  },
  { _id: false }
);

const chatMessageSchema = new Schema<ChatMessageDocument>(
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
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    type: {
      type: String,
      enum: ['message', 'system', 'notification'],
      default: 'message',
    },
    replyTo: {
      type: String,
      ref: 'ChatMessage',
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    deleted: {
      type: Boolean,
      default: false,
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
chatMessageSchema.index({ workspaceId: 1, createdAt: -1 });
chatMessageSchema.index({ userId: 1 });

export const ChatMessage = mongoose.model<ChatMessageDocument>('ChatMessage', chatMessageSchema);

export default ChatMessage;
