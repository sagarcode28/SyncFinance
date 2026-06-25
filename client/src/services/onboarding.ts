// Onboarding service - creates welcome workspace + testing document for new users
import { api } from './api';
import type { Workspace, FinancialDocument } from '../types';

export interface OnboardingResult {
  workspace?: Workspace;
  document?: FinancialDocument;
  alreadyOnboarded?: boolean;
  error?: string;
}

/**
 * Creates a welcome workspace with a testing document for new users
 */
export async function onboardNewUser(): Promise<OnboardingResult> {
  try {
    // Check if user already has workspaces (already onboarded)
    const existingRes = await api.getWorkspaces(1, 1);
    if (existingRes.success && existingRes.data && existingRes.data.length > 0) {
      return { alreadyOnboarded: true };
    }

    // Step 1: Create welcome workspace
    const workspaceRes = await api.createWorkspace({
      name: 'Getting Started',
      description: 'Your first workspace - explore SyncFinance features and learn how real-time collaboration works.',
    });

    if (!workspaceRes.success || !workspaceRes.data) {
      return { error: workspaceRes.error?.message || 'Failed to create workspace' };
    }

    const workspace = workspaceRes.data;

    // Step 2: Create testing document
    const docRes = await api.createDocument({
      title: 'Try Editing This Document',
      type: 'budget',
      workspaceId: workspace.id,
    });

    if (!docRes.success || !docRes.data) {
      return { workspace, error: docRes.error?.message };
    }

    const document = docRes.data;

    // Step 3: Add sample rows with test data
    // Add a few rows so users can try editing
    await api.addRow(document.id);
    await api.addRow(document.id);
    await api.addRow(document.id);

    return { workspace, document };
  } catch (error: any) {
    return { error: error.message || 'Onboarding failed' };
  }
}
