import { Response, NextFunction } from 'express';
import { ChatService } from '../services/ChatService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const chatController = {
  async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await ChatService.getMessages(
        req.params.workspaceId,
        req.userId!,
        req.query
      );
      
      res.json({
        success: true,
        data: result.messages,
        meta: {
          page: result.page,
          limit: 50,
          total: result.total,
          totalPages: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await ChatService.sendMessage(req.userId!, {
        workspaceId: req.params.workspaceId,
        content: req.body.content,
        replyTo: req.body.replyTo,
      });
      
      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await ChatService.deleteMessage(req.params.messageId, req.userId!);
      
      res.json({
        success: true,
        data: { message: 'Message deleted' },
      });
    } catch (error) {
      next(error);
    }
  },

  async addReaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await ChatService.addReaction(
        req.params.messageId,
        req.userId!,
        req.body.emoji
      );
      
      res.json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  },

  async removeReaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const message = await ChatService.removeReaction(
        req.params.messageId,
        req.userId!,
        req.body.emoji
      );
      
      res.json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default chatController;
