import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useApp } from '../../context/AppContext';
import { Loader2, X } from 'lucide-react';
import { useState } from 'react';
import type { FinancialDocument } from '../../types';

const typeLabels: Record<string, string> = {
  budget: 'Budget',
  expense: 'Expense',
  forecast: 'Forecast',
  report: 'Report',
};

const typeColors: Record<string, string> = {
  budget: '#007cf0',
  expense: '#ff0080',
  forecast: '#7928ca',
  report: '#f5a623',
};

interface CreateDocumentValues {
  title: string;
  type: FinancialDocument['type'];
  description: string;
}

const createDocumentSchema = Yup.object().shape({
  title: Yup.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title is too long')
    .required('Document title is required'),
  type: Yup.string()
    .oneOf(['budget', 'expense', 'forecast', 'report'], 'Please select a valid type')
    .required('Document type is required'),
  description: Yup.string()
    .max(500, 'Description is too long'),
});

interface Props {
  onClose: () => void;
}

export function CreateDocumentModal({ onClose }: Props) {
  const { createDocument } = useApp();
  const [apiError, setApiError] = useState('');

  const formik = useFormik<CreateDocumentValues>({
    initialValues: {
      title: '',
      type: 'budget',
      description: '',
    },
    validationSchema: createDocumentSchema,
    onSubmit: async (values) => {
      setApiError('');
      try {
        await createDocument(values.title, values.type);
        onClose();
      } catch (error) {
        setApiError('Failed to create document. Please try again.');
      }
    },
  });

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-canvas rounded-xl border border-hairline elev-modal w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold tracking-[-0.3px] text-ink">Create document</h2>
          <button
            onClick={onClose}
            className="text-mute hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-body mb-5">Add a new financial document to this workspace.</p>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          {apiError && (
            <div className="bg-error-soft text-error-deep text-sm px-3 py-2 rounded-md">
              {apiError}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-ink mb-1.5">
              Document title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.title}
              className={`w-full h-10 px-3 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
                formik.touched.title && formik.errors.title ? 'border-error' : 'border-hairline'
              }`}
              placeholder="e.g., Q1 2025 Budget"
              autoFocus
            />
            {formik.touched.title && formik.errors.title && (
              <p className="text-xs text-error mt-1">{formik.errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Document type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['budget', 'expense', 'forecast', 'report'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => formik.setFieldValue('type', t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-colors ${
                    formik.values.type === t
                      ? 'border-link bg-link-bg-soft text-ink font-medium'
                      : 'border-hairline text-body hover:border-hairline-strong hover:text-ink'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeColors[t] }}
                  />
                  {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-ink mb-1.5">
              Description <span className="text-mute font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.description}
              className={`w-full px-3 py-2 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors resize-none ${
                formik.touched.description && formik.errors.description ? 'border-error' : 'border-hairline'
              }`}
              placeholder="Brief description of this document"
            />
            {formik.touched.description && formik.errors.description && (
              <p className="text-xs text-error mt-1">{formik.errors.description}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-body hover:text-ink bg-canvas-soft2 rounded-full border border-hairline hover:border-hairline-strong transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formik.isSubmitting || !formik.isValid}
              className="px-4 py-2 text-sm font-medium bg-ink text-on-primary rounded-full hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {formik.isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create document'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateWorkspaceValues {
  name: string;
  description: string;
}

const createWorkspaceSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .required('Workspace name is required'),
  description: Yup.string()
    .max(500, 'Description is too long'),
});

interface WorkspaceModalProps {
  onClose: () => void;
}

export function CreateWorkspaceModal({ onClose }: WorkspaceModalProps) {
  const { createWorkspace } = useApp();
  const [apiError, setApiError] = useState('');

  const formik = useFormik<CreateWorkspaceValues>({
    initialValues: { name: '', description: '' },
    validationSchema: createWorkspaceSchema,
    onSubmit: async (values) => {
      setApiError('');
      try {
        await createWorkspace(values.name, values.description);
        onClose();
      } catch (error) {
        setApiError('Failed to create workspace. Please try again.');
      }
    },
  });

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-canvas rounded-xl border border-hairline elev-modal w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold tracking-[-0.3px] text-ink">Create workspace</h2>
          <button onClick={onClose} className="text-mute hover:text-ink transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-body mb-5">Create a new space for your team to collaborate.</p>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          {apiError && (
            <div className="bg-error-soft text-error-deep text-sm px-3 py-2 rounded-md">{apiError}</div>
          )}

          <div>
            <label htmlFor="ws-name" className="block text-sm font-medium text-ink mb-1.5">
              Workspace name
            </label>
            <input
              id="ws-name"
              name="name"
              type="text"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.name}
              className={`w-full h-10 px-3 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors ${
                formik.touched.name && formik.errors.name ? 'border-error' : 'border-hairline'
              }`}
              placeholder="e.g., Series A Planning"
              autoFocus
            />
            {formik.touched.name && formik.errors.name && (
              <p className="text-xs text-error mt-1">{formik.errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="ws-desc" className="block text-sm font-medium text-ink mb-1.5">
              Description <span className="text-mute font-normal">(optional)</span>
            </label>
            <textarea
              id="ws-desc"
              name="description"
              rows={3}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.description}
              className={`w-full px-3 py-2 bg-canvas-soft border rounded-md text-sm text-ink placeholder:text-mute focus:outline-none transition-colors resize-none ${
                formik.touched.description && formik.errors.description ? 'border-error' : 'border-hairline'
              }`}
              placeholder="What is this workspace for?"
            />
            {formik.touched.description && formik.errors.description && (
              <p className="text-xs text-error mt-1">{formik.errors.description}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-body hover:text-ink bg-canvas-soft2 rounded-full border border-hairline hover:border-hairline-strong transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formik.isSubmitting || !formik.isValid}
              className="px-4 py-2 text-sm font-medium bg-ink text-on-primary rounded-full hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {formik.isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create workspace'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
