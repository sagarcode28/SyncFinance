import mongoose, { Schema, Document as MongoDocument } from 'mongoose';
import type { 
  FinancialDocument, 
  SpreadsheetRow, 
  SpreadsheetCell, 
  DocumentVersion,
  ChangeRecord,
  CellFormat 
} from '@shared/types/index.js';

export interface DocumentModel extends Omit<FinancialDocument, 'id'>, MongoDocument {}

const cellFormatSchema = new Schema<CellFormat>(
  {
    bold: Boolean,
    italic: Boolean,
    textColor: String,
    backgroundColor: String,
    alignment: {
      type: String,
      enum: ['left', 'center', 'right'],
    },
  },
  { _id: false }
);

const spreadsheetCellSchema = new Schema<SpreadsheetCell>(
  {
    id: {
      type: String,
      required: true,
    },
    columnIndex: {
      type: Number,
      required: true,
    },
    value: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['text', 'number', 'currency', 'percentage', 'date', 'formula'],
      default: 'text',
    },
    formula: String,
    format: cellFormatSchema,
  },
  { _id: false }
);

const spreadsheetRowSchema = new Schema<SpreadsheetRow>(
  {
    id: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    cells: {
      type: [spreadsheetCellSchema],
      default: [],
    },
  },
  { _id: false }
);

const changeRecordSchema = new Schema<ChangeRecord>(
  {
    id: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
    },
    rowId: String,
    cellId: String,
    field: {
      type: String,
      required: true,
    },
    oldValue: String,
    newValue: String,
    timestamp: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  { _id: false }
);

const documentVersionSchema = new Schema<DocumentVersion>(
  {
    id: {
      type: String,
      required: true,
    },
    documentId: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    snapshot: {
      type: [spreadsheetRowSchema],
      required: true,
    },
    changes: {
      type: [changeRecordSchema],
      default: [],
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: String,
      default: () => new Date().toISOString(),
    },
    message: String,
  },
  { _id: false }
);

const documentSchema = new Schema<DocumentModel>(
  {
    workspaceId: {
      type: String,
      required: true,
      ref: 'Workspace',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      minlength: [1, 'Title must be at least 1 character'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    type: {
      type: String,
      enum: ['budget', 'expense', 'forecast', 'report'],
      required: true,
    },
    rows: {
      type: [spreadsheetRowSchema],
      default: [],
    },
    versions: {
      type: [documentVersionSchema],
      default: [],
    },
    createdBy: {
      type: String,
      required: true,
      ref: 'User',
    },
    lockedBy: {
      type: String,
      ref: 'User',
    },
    lockedAt: String,
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

// Indexes for efficient queries
documentSchema.index({ workspaceId: 1, createdAt: -1 });
documentSchema.index({ createdBy: 1 });
documentSchema.index({ type: 1, workspaceId: 1 });

export const FinancialDoc = mongoose.model<DocumentModel>('Document', documentSchema);

export default FinancialDoc;
