import { v4 as uuid } from 'uuid';
import { FinancialDoc, AuditLog, Workspace } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { 
  FinancialDocument, 
  CreateDocumentRequest,
  SpreadsheetRow,
  SpreadsheetCell,
  DocumentVersion,
  ChangeRecord,
  PaginationQuery,
  DocumentType
} from '@shared/types/index.js';

export class DocumentService {

  static async create(userId: string, data: CreateDocumentRequest): Promise<FinancialDocument> {
    // Verify user has access to workspace
    const workspace = await Workspace.findById(data.workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    const member = workspace.members.find((m: any) => m.userId === userId);
    if (!member) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    if (member.role === 'viewer') {
      throw new AppError('Viewers cannot create documents', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    // Create default structure based on type
    const rows = this.createDefaultRows(data.type);

    const document = await FinancialDoc.create({
      workspaceId: data.workspaceId,
      title: data.title,
      type: data.type,
      rows,
      createdBy: userId,
    });

    await AuditLog.create({
      workspaceId: data.workspaceId,
      userId,
      action: 'create',
      resource: 'document',
      resourceId: document._id.toString(),
      details: { title: data.title, type: data.type },
      timestamp: new Date().toISOString(),
    });

    return document.toJSON() as FinancialDocument;
  }

  static async findById(documentId: string, userId: string): Promise<FinancialDocument> {
    const document = await FinancialDoc.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Verify user has access
    const workspace = await Workspace.findById(document.workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    const member = workspace.members.find((m: any) => m.userId === userId);
    if (!member) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    return document.toJSON() as FinancialDocument;
  }

  static async findByWorkspace(
    workspaceId: string, 
    userId: string,
    query: PaginationQuery & { type?: DocumentType } = {}
  ): Promise<{
    documents: FinancialDocument[];
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

    const { page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc', type } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { workspaceId };
    if (type) filter.type = type;

    const [documents, total] = await Promise.all([
      FinancialDoc.find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      FinancialDoc.countDocuments(filter),
    ]);

    return {
      documents: documents.map(d => d.toJSON() as FinancialDocument),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async updateCell(
    documentId: string,
    userId: string,
    rowIndex: number,
    cellIndex: number,
    value: string,
    clientVersion?: number
  ): Promise<{ document: FinancialDocument; change: ChangeRecord }> {
    const document = await FinancialDoc.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Verify permissions
    const workspace = await Workspace.findById(document.workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }

    const member = workspace.members.find((m: any) => m.userId === userId);
    if (!member || member.role === 'viewer') {
      throw new AppError('Edit access required', 403, 'EDIT_ACCESS_REQUIRED');
    }

    // Validate row/cell indices
    if (rowIndex < 0 || rowIndex >= document.rows.length) {
      throw new AppError('Invalid row index', 400, 'INVALID_ROW_INDEX');
    }

    const row = document.rows[rowIndex];
    if (cellIndex < 0 || cellIndex >= row.cells.length) {
      throw new AppError('Invalid cell index', 400, 'INVALID_CELL_INDEX');
    }

    const cell = row.cells[cellIndex];
    const oldValue = cell.value;

    // Update cell
    cell.value = value;
    cell.type = this.detectCellType(value);

    // Create change record
    const change: ChangeRecord = {
      id: uuid(),
      userId,
      action: 'update',
      rowId: row.id,
      cellId: cell.id,
      field: `row[${rowIndex}].cell[${cellIndex}]`,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString(),
    };

    await document.save();

    // Cross-instance broadcast is handled by the Socket.io Redis adapter; the
    // calling socket handler emits 'cell-updated' to the document room.

    await AuditLog.create({
      workspaceId: document.workspaceId,
      userId,
      action: 'update',
      resource: 'cell',
      resourceId: cell.id,
      details: { documentId, rowIndex, cellIndex, oldValue, newValue: value },
      timestamp: new Date().toISOString(),
    });

    return { document: document.toJSON() as FinancialDocument, change };
  }

  static async addRow(
    documentId: string,
    userId: string,
    afterRowIndex?: number
  ): Promise<{ document: FinancialDocument; row: SpreadsheetRow }> {
    const document = await FinancialDoc.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Verify permissions
    const workspace = await Workspace.findById(document.workspaceId);
    const member = workspace?.members.find((m: any) => m.userId === userId);
    if (!member || member.role === 'viewer') {
      throw new AppError('Edit access required', 403, 'EDIT_ACCESS_REQUIRED');
    }

    const columnCount = document.rows[0]?.cells.length || 6;
    const insertIndex = afterRowIndex !== undefined 
      ? Math.min(afterRowIndex + 1, document.rows.length)
      : document.rows.length;

    const newRow: SpreadsheetRow = {
      id: uuid(),
      order: insertIndex,
      cells: Array.from({ length: columnCount }, (_, i) => ({
        id: uuid(),
        columnIndex: i,
        value: '',
        type: 'text' as const,
      })),
    };

    document.rows.splice(insertIndex, 0, newRow);
    
    // Update order of subsequent rows
    for (let i = insertIndex + 1; i < document.rows.length; i++) {
      document.rows[i].order = i;
    }

    await document.save();

    return { document: document.toJSON() as FinancialDocument, row: newRow };
  }

  static async deleteRow(
    documentId: string,
    userId: string,
    rowIndex: number
  ): Promise<FinancialDocument> {
    const document = await FinancialDoc.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Verify permissions
    const workspace = await Workspace.findById(document.workspaceId);
    const member = workspace?.members.find((m: any) => m.userId === userId);
    if (!member || member.role === 'viewer') {
      throw new AppError('Edit access required', 403, 'EDIT_ACCESS_REQUIRED');
    }

    if (rowIndex < 0 || rowIndex >= document.rows.length) {
      throw new AppError('Invalid row index', 400, 'INVALID_ROW_INDEX');
    }

    // Don't allow deleting header row
    if (rowIndex === 0) {
      throw new AppError('Cannot delete header row', 400, 'CANNOT_DELETE_HEADER');
    }

    const deletedRow = document.rows.splice(rowIndex, 1)[0];

    // Update order of subsequent rows
    for (let i = rowIndex; i < document.rows.length; i++) {
      document.rows[i].order = i;
    }

    await document.save();

    return document.toJSON() as FinancialDocument;
  }

  static async saveVersion(
    documentId: string,
    userId: string,
    message?: string
  ): Promise<DocumentVersion> {
    const document = await FinancialDoc.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    const versionNumber = document.versions.length + 1;
    
    const version: DocumentVersion = {
      id: uuid(),
      documentId,
      version: versionNumber,
      snapshot: JSON.parse(JSON.stringify(document.rows)),
      changes: [], // Could accumulate changes since last version
      createdBy: userId,
      createdAt: new Date().toISOString(),
      message,
    };

    document.versions.push(version);
    await document.save();

    return version;
  }

  static async restoreVersion(
    documentId: string,
    userId: string,
    versionId: string
  ): Promise<FinancialDocument> {
    const document = await FinancialDoc.findById(documentId);

    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Verify permissions: admin, finance_manager, or the original document
    // creator may restore a version. Viewers must never mutate the document.
    const workspace = await Workspace.findById(document.workspaceId);
    const member = workspace?.members.find((m: any) => m.userId === userId);
    if (!member) {
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }
    const isPrivileged =
      member.role === 'admin' ||
      member.role === 'finance_manager' ||
      document.createdBy === userId;
    if (!isPrivileged) {
      throw new AppError('Editor access required', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    const target = document.versions.find((v: any) => v.id === versionId);
    if (!target) {
      throw new AppError('Version not found', 404, 'VERSION_NOT_FOUND');
    }

    // Snapshot the *current* state into a new version so the restore is reversible,
    // then overwrite the rows — all in a single Mongoose save() to avoid the
    // optimistic-concurrency VersionError we hit when calling saveVersion() and
    // then save()-ing again on the now-stale document instance.
    const backupVersion: DocumentVersion = {
      id: uuid(),
      documentId,
      version: document.versions.length + 1,
      snapshot: JSON.parse(JSON.stringify(document.rows)),
      changes: [],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      message: `Auto-save before restore to v${target.version}`,
    };
    document.versions.push(backupVersion);
    document.rows = JSON.parse(JSON.stringify(target.snapshot));
    await document.save();

    return document.toJSON() as FinancialDocument;
  }

  static async delete(documentId: string, userId: string): Promise<void> {
    const document = await FinancialDoc.findById(documentId);
    
    if (!document) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Verify permissions
    const workspace = await Workspace.findById(document.workspaceId);
    const member = workspace?.members.find((m: any) => m.userId === userId);
    if (!member || (member.role !== 'admin' && document.createdBy !== userId)) {
      throw new AppError('Cannot delete this document', 403, 'DELETE_NOT_ALLOWED');
    }

    await document.deleteOne();

    await AuditLog.create({
      workspaceId: document.workspaceId,
      userId,
      action: 'delete',
      resource: 'document',
      resourceId: documentId,
      details: { title: document.title },
      timestamp: new Date().toISOString(),
    });
  }

  private static createDefaultRows(type: DocumentType): SpreadsheetRow[] {
    const headers: Record<DocumentType, string[]> = {
      budget: ['Category', 'Allocated', 'Spent', 'Remaining', '% Used'],
      expense: ['Expense', 'Vendor', 'Amount', 'Date', 'Status'],
      forecast: ['Category', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'],
      report: ['Item', 'Value', 'Notes', 'Status'],
    };

    const headerRow: SpreadsheetRow = {
      id: uuid(),
      order: 0,
      cells: headers[type].map((h, i) => ({
        id: uuid(),
        columnIndex: i,
        value: h,
        type: 'text' as const,
      })),
    };

    const emptyRow: SpreadsheetRow = {
      id: uuid(),
      order: 1,
      cells: headers[type].map((_, i) => ({
        id: uuid(),
        columnIndex: i,
        value: '',
        type: 'text' as const,
      })),
    };

    return [headerRow, emptyRow];
  }

  private static detectCellType(value: string): SpreadsheetCell['type'] {
    if (value.startsWith('$') || value.startsWith('-$')) return 'currency';
    if (value.endsWith('%')) return 'percentage';
    if (!isNaN(Number(value)) && value !== '') return 'number';
    if (value.startsWith('=')) return 'formula';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'text';
  }

}

export default DocumentService;
