import { Response, NextFunction } from 'express';
import { WorkspaceService } from '../services/WorkspaceService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const workspaceController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await WorkspaceService.create(req.userId!, req.body);
      
      res.status(201).json({
        success: true,
        data: workspace,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await WorkspaceService.findByUser(req.userId!, req.query);
      
      res.json({
        success: true,
        data: result.workspaces,
        meta: {
          page: result.page,
          limit: 20,
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

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await WorkspaceService.findById(req.params.id, req.userId!);
      
      res.json({
        success: true,
        data: workspace,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const workspace = await WorkspaceService.update(req.params.id, req.userId!, req.body);
      
      res.json({
        success: true,
        data: workspace,
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await WorkspaceService.delete(req.params.id, req.userId!);
      
      res.json({
        success: true,
        data: { message: 'Workspace deleted' },
      });
    } catch (error) {
      next(error);
    }
  },

  async inviteMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const member = await WorkspaceService.inviteMember(
        req.params.id,
        req.userId!,
        req.body.email,
        req.body.role
      );
      
      res.status(201).json({
        success: true,
        data: member,
      });
    } catch (error) {
      next(error);
    }
  },

  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await WorkspaceService.removeMember(req.params.id, req.userId!, req.params.memberId);
      
      res.json({
        success: true,
        data: { message: 'Member removed' },
      });
    } catch (error) {
      next(error);
    }
  },

  async updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const member = await WorkspaceService.updateMemberRole(
        req.params.id,
        req.userId!,
        req.params.memberId,
        req.body.role
      );
      
      res.json({
        success: true,
        data: member,
      });
    } catch (error) {
      next(error);
    }
  },

  async getMembers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const members = await WorkspaceService.getMembers(req.params.id, req.userId!);
      
      res.json({
        success: true,
        data: members,
      });
    } catch (error) {
      next(error);
    }
  },

};

export default workspaceController;
