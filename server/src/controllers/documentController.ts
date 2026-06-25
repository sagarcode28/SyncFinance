import { Response, NextFunction } from 'express';
import { DocumentService } from '../services/DocumentService.js';
import { getIO } from '../socket/index.js';
import type { AuthRequest } from '../middleware/auth.js';

export const documentController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const document = await DocumentService.create(req.userId!, req.body);
      
      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async listByWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await DocumentService.findByWorkspace(
        req.params.workspaceId,
        req.userId!,
        req.query
      );
      
      res.json({
        success: true,
        data: result.documents,
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
      const document = await DocumentService.findById(req.params.id, req.userId!);
      
      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateCell(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { rowIndex, cellIndex, value, clientVersion } = req.body;
      
      const { document, change } = await DocumentService.updateCell(
        req.params.id,
        req.userId!,
        rowIndex,
        cellIndex,
        value,
        clientVersion
      );
      
      res.json({
        success: true,
        data: { document, change },
      });
    } catch (error) {
      next(error);
    }
  },

  async addRow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { afterRowIndex } = req.body;
      
      const { document, row } = await DocumentService.addRow(
        req.params.id,
        req.userId!,
        afterRowIndex
      );
      
      res.json({
        success: true,
        data: { document, row },
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteRow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { rowIndex } = req.body;
      
      const document = await DocumentService.deleteRow(req.params.id, req.userId!, rowIndex);
      
      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async saveVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { message } = req.body;
      const documentId = req.params.id;

      const version = await DocumentService.saveVersion(documentId, req.userId!, message);

      // Notify every collaborator currently in the document room.
      const io = getIO();
      if (io) {
        io.to(`document:${documentId}`).emit('version-saved', { documentId, version });
      }

      res.json({
        success: true,
        data: version,
      });
    } catch (error) {
      next(error);
    }
  },

  async restoreVersion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const document = await DocumentService.restoreVersion(
        req.params.id,
        req.userId!,
        req.params.versionId
      );

      const io = getIO();
      if (io) {
        io.to(`document:${req.params.id}`).emit('document-restored', { documentId: req.params.id, document });
      }

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await DocumentService.delete(req.params.id, req.userId!);

      const io = getIO();
      if (io) {
        io.to(`document:${req.params.id}`).emit('document-deleted', { documentId: req.params.id });
      }

      res.json({
        success: true,
        data: { message: 'Document deleted' },
      });
    } catch (error) {
      next(error);
    }
  },
};

export default documentController;
