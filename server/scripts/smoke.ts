/**
 * End-to-end smoke test that exercises the critical user journey:
 *   register -> login -> /auth/me -> create workspace -> list workspaces ->
 *   create document -> fetch workspace members -> change password ->
 *   login with new password -> logout.
 *
 * Run with: npx tsx e2e-test.ts (server must already be running on :3001)
 */

const BASE = 'http://localhost:3001/api';
const ORIGIN = 'http://localhost:5173';

interface Json {
  success: boolean;
  data?: any;
  error?: { code: string; message: string; details?: unknown };
}

let pass = 0;
let fail = 0;

async function step(name: string, fn: () => Promise<void>) {
  process.stdout.write(`• ${name} ... `);
  try {
    await fn();
    pass++;
    console.log('OK');
  } catch (err: any) {
    fail++;
    console.log('FAIL');
    console.error('  ↳', err.message);
  }
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as Json;
  return { status: res.status, json };
}

(async function main() {
  const stamp = Date.now();
  const email = `e2e+${stamp}@example.com`;
  const password = 'Password123';
  const newPassword = 'Password456';

  let accessToken = '';
  let refreshToken = '';
  let workspaceId = '';
  let documentId = '';

  await step('register', async () => {
    const { status, json } = await call('POST', '/auth/register', {
      name: 'E2E User',
      email,
      password,
      role: 'admin',
    });
    if (status !== 201 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    accessToken = json.data.tokens.accessToken;
    refreshToken = json.data.tokens.refreshToken;
  });

  await step('/auth/me with access token', async () => {
    const { status, json } = await call('GET', '/auth/me', undefined, accessToken);
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    if (json.data.user.email !== email) throw new Error('email mismatch');
  });

  await step('login with same credentials', async () => {
    const { status, json } = await call('POST', '/auth/login', { email, password });
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    accessToken = json.data.tokens.accessToken;
    refreshToken = json.data.tokens.refreshToken;
  });

  await step('create workspace', async () => {
    const { status, json } = await call(
      'POST',
      '/workspaces',
      { name: 'E2E Workspace', description: 'Created by smoke test' },
      accessToken
    );
    if (status !== 201 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    workspaceId = json.data.id;
  });

  await step('list workspaces', async () => {
    const { status, json } = await call('GET', '/workspaces', undefined, accessToken);
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    if (!Array.isArray(json.data) || json.data.length === 0) {
      throw new Error('expected at least one workspace');
    }
  });

  await step('create document', async () => {
    const { status, json } = await call(
      'POST',
      '/documents',
      { title: 'Q4 Budget', type: 'budget', workspaceId },
      accessToken
    );
    if (status !== 201 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    documentId = json.data.id;
  });

  await step('fetch document', async () => {
    const { status, json } = await call('GET', `/documents/${documentId}`, undefined, accessToken);
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
  });

  await step('list workspace members', async () => {
    const { status, json } = await call(
      'GET',
      `/workspaces/${workspaceId}/members`,
      undefined,
      accessToken
    );
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    if (!Array.isArray(json.data) || json.data.length === 0) throw new Error('no members');
  });

  await step('update profile', async () => {
    const { status, json } = await call(
      'PATCH',
      '/auth/me',
      { name: 'E2E User Renamed' },
      accessToken
    );
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    if (json.data.user.name !== 'E2E User Renamed') throw new Error('name not updated');
  });

  await step('change password', async () => {
    const { status, json } = await call(
      'POST',
      '/auth/change-password',
      { currentPassword: password, newPassword },
      accessToken
    );
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
  });

  await step('login with new password', async () => {
    const { status, json } = await call('POST', '/auth/login', {
      email,
      password: newPassword,
    });
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
    accessToken = json.data.tokens.accessToken;
  });

  await step('logout', async () => {
    const { status, json } = await call('POST', '/auth/logout', { refreshToken }, accessToken);
    if (status !== 200 || !json.success) throw new Error(`${status} ${JSON.stringify(json)}`);
  });

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
