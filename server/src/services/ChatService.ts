import { ChatMessage, Workspace, User, Notification } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { 
  ChatMessage as IChatMessage,
  SendMessageRequest,
  PaginationQuery,
  UserPublic
} from '@shared/types/index.js';

export class ChatService {

  static async sendMessage(
    userId: string,
    data: SendMessageRequest
  ): Promise<IChatMessage & { user: UserPublic }> {
    // Verify user has access to workspace
    const workspace = await Workspace.findById(data.workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    const member = workspace.members.find((m: any) => m.userId === userId);
    if (!member) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const message = await ChatMessage.create({
      workspaceId: data.workspaceId,
      userId,
      content: data.content,
      type: 'message',
      replyTo: data.replyTo,
    });

    const messageWithUser = {
      ...message.toJSON(),
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        color: user.color,
      },
    } as IChatMessage & { user: UserPublic };

    // Cross-instance fanout is handled by the Socket.io Redis adapter — the
    // socket handler will io.to(`workspace:${workspaceId}`).emit('new-message', …)
    // and the adapter takes care of the multi-instance broadcast.

    // Create notifications for mentioned users
    await this.handleMentions(data.content, data.workspaceId, user.name, message._id.toString());

    return messageWithUser;
  }

  static async getMessages(
    workspaceId: string,
    userId: string,
    query: PaginationQuery = {}
  ): Promise<{
    messages: (IChatMessage & { user: UserPublic })[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // Verify user has access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    const member = workspace.members.find((m: any) => m.userId === userId);
    if (!member) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      ChatMessage.find({ workspaceId, deleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ChatMessage.countDocuments({ workspaceId, deleted: { $ne: true } }),
    ]);

    // Get all unique user IDs
    const userIds = [...new Set(messages.map((m: any) => m.userId))];
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const messagesWithUsers = messages.map((m: any) => {
      const user = userMap.get(m.userId);
      return {
        ...m.toJSON(),
        user: user ? {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          color: user.color,
        } : {
          id: m.userId,
          name: 'Unknown User',
          email: '',
          role: 'viewer',
          avatar: '??',
          color: '#888',
        },
      };
    }) as (IChatMessage & { user: UserPublic })[];

    return {
      messages: messagesWithUsers.reverse(), // Oldest first
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<void> {
    const message = await ChatMessage.findById(messageId);
    
    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    // Only message owner or workspace admin can delete
    const workspace = await Workspace.findById(message.workspaceId);
    const member = workspace?.members.find((m: any) => m.userId === userId);
    
    if (message.userId !== userId && member?.role !== 'admin') {
      throw new AppError('Cannot delete this message', 403, 'DELETE_NOT_ALLOWED');
    }

    message.deleted = true;
    message.content = '[Message deleted]';
    await message.save();
  }

  static async addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<IChatMessage> {
    const message = await ChatMessage.findById(messageId);
    
    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    const reaction = (message.reactions || []).find((r: any) => r.emoji === emoji);
    
    if (reaction) {
      if (!reaction.userIds.includes(userId)) {
        reaction.userIds.push(userId);
      }
    } else {
      if (!message.reactions) message.reactions = []; message.reactions.push({ emoji, userIds: [userId] });
    }

    await message.save();
    return message.toJSON() as IChatMessage;
  }

  static async removeReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<IChatMessage> {
    const message = await ChatMessage.findById(messageId);
    
    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    if (!message.reactions) {
      message.reactions = [];
    }

    const reactionIndex = message.reactions.findIndex((r: any) => r.emoji === emoji);
    
    if (reactionIndex !== -1) {
      const reaction = message.reactions[reactionIndex];
      const userIndex = reaction.userIds.indexOf(userId);
      
      if (userIndex !== -1) {
        reaction.userIds.splice(userIndex, 1);
        
        if (reaction.userIds.length === 0) {
          message.reactions.splice(reactionIndex, 1);
        }
      }
    }

    await message.save();
    return message.toJSON() as IChatMessage;
  }

  static async createSystemMessage(
    workspaceId: string,
    content: string
  ): Promise<IChatMessage> {
    const message = await ChatMessage.create({
      workspaceId,
      userId: 'system',
      content,
      type: 'system',
    });

    return message.toJSON() as IChatMessage;
  }

  private static async handleMentions(
    content: string,
    workspaceId: string,
    senderName: string,
    messageId: string
  ): Promise<void> {
    // Extract @mentions from content. Supports two forms:
    //   - @username        — single word (matches first word of the user's name)
    //   - @[Full Name]     — multi-word names wrapped in square brackets
    // The previous regex /@(\w+(?:\s+\w+)?)/g was too greedy: it would slurp the
    // word AFTER the mention (e.g. "@Bob please" → captured "Bob please"),
    // causing every mention to silently fail to match a real user.
    const mentions = [
      ...content.matchAll(/@\[([^\]]+)\]/g),
      ...content.matchAll(/@(\w+)/g),
    ];
    if (mentions.length === 0) return;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return;

    const notifiedUserIds = new Set<string>();

    for (const match of mentions) {
      const handle = match[1].trim().toLowerCase();
      if (!handle) continue;

      for (const member of workspace.members) {
        if (notifiedUserIds.has(member.userId)) continue;
        const user = await User.findById(member.userId);
        if (!user) continue;
        const fullName = user.name.toLowerCase();
        const firstName = fullName.split(/\s+/)[0];
        // Match if @handle equals the user's first name, full name, or is a
        // substring of the full name (useful for "Alice" matching "Alice Smith").
        if (
          firstName === handle ||
          fullName === handle ||
          fullName.split(/\s+/).includes(handle)
        ) {
          await Notification.create({
            userId: user._id.toString(),
            type: 'mention',
            title: 'You were mentioned',
            message: `${senderName} mentioned you in a message`,
            data: { workspaceId, messageId },
          });
          notifiedUserIds.add(member.userId);
          break;
        }
      }
    }
  }
}

export default ChatService;
