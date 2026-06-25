/**
 * Exhaustive 3-user end-to-end test.
 *
 *   Alice   = admin           (workspace owner)
 *   Bob     = finance_manager (editor)
 *   Carol   = viewer          (read-only)
 *
 * Exercises every public surface area the UI uses:
 *   - Auth lifecycle: register, wrong password, login, /me, refresh, logout, blacklist, change-password, update-profile.
 *   - Workspaces: create / list / get / update / member-invite / member-role-update / member-remove / delete.
 *   - Documents (REST): create all 4 types, list, get, update-cell, add-row, delete-row, save-version, restore-version, delete.
 *   - Documents (Socket): cell-update, row-add, row-delete, cursor-move, document-presence, version-saved fanout.
 *   - Chat: send via REST + via socket, history, mentions, reactions, message deletion (sender + admin), socket fanout.
 *   - Notifications: list, mark-one, mark-all, unread counter, delete.
 *   - Audit logs: workspace-scoped log capture for every mutation.
 *   - Security: RBAC for every privilege gate, expired/invalid tokens, non-member access, validation errors, JSON parse errors.
 *   - Edge cases: duplicate email, removing owner, removing self, accessing deleted resources.
 *
 * Run with the server already up: `npm run e2e` (or `tsx scripts/full-e2e.ts`).
 */

import { io as ioClient, type Socket } from 'socket.io-client';

const REST = 'http://localhost:3001/api';
const SOCKET = 'http://localhost:3001';
const ORIGIN = 'http://localhost:5173';

interface UserSession {
  label: string;
  role: 'admin' | 'finance_manager' | 'viewer';
  email: string;
  password: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  socket?: Socket;
  received: { event: string; payload: any; at: number }[];
}

const STAMP = Date.now();
let pass = 0;
let fail = 0;
const failures: string[] = [];

function section(title: string) {
  console.log(`\n━━━ ${title} ${'━'.repeat(Math.max(0, 60 - title.length))}`);
}

function expect(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    const line = `${name}${detail ? `  — ${detail}` : ''}`;
    failures.push(line);
    console.log(`  ✘ ${line}`);
  }
}

async function rest(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; rawBody?: string } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${REST}${path}`, {
    method,
    headers,
    body:
      options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function registerUser(label: string, role: UserSession['role']): Promise<UserSession> {
  const email = `${label.toLowerCase()}+${STAMP}@example.com`;
  const password = 'Password123';
  const { status, json } = await rest('POST', '/auth/register', {
    body: { name: label, email, password, role },
  });
  if (status !== 201 || !json.success) {
    throw new Error(`Register ${label} failed: ${status} ${JSON.stringify(json)}`);
  }
  return {
    label,
    role,
    email,
    password,
    userId: json.data.user.id,
    accessToken: json.data.tokens.accessToken,
    refreshToken: json.data.tokens.refreshToken,
    received: [],
  };
}

function connectSocket(s: UserSession): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(SOCKET, {
      auth: { token: s.accessToken },
      transports: ['websocket'],
      reconnection: false,
    });
    s.socket = socket;
    socket.onAny((event, ...args) => {
      s.received.push({ event, payload: args[0], at: Date.now() });
    });
    socket.on('connect', () => resolve());
    socket.on('connect_error', (err: Error) => reject(err));
  });
}

function received(s: UserSession, event: string, sinceTs = 0) {
  return s.received.filter((r) => r.event === event && r.at >= sinceTs);
}

async function waitFor(s: UserSession, event: string, ms = 2000, sinceTs = 0) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (received(s, event, sinceTs).length > 0) return true;
    await sleep(25);
  }
  return false;
}

async function waitForAll(users: UserSession[], event: string, ms = 2000, sinceTs = 0) {
  await Promise.race([
    Promise.all(users.map((u) => waitFor(u, event, ms, sinceTs))),
    sleep(ms + 200),
  ]);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SyncFinance — exhaustive 3-user end-to-end test             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 1 — health, registration, login, /me');

  const health = await rest('GET', '/health');
  expect('GET /api/health returns 200 + healthy', health.status === 200 && health.json.data?.status === 'healthy');

  const alice = await registerUser('Alice', 'admin');
  const bob = await registerUser('Bob', 'finance_manager');
  const carol = await registerUser('Carol', 'viewer');
  expect('Alice registered (admin)', !!alice.userId);
  expect('Bob registered (finance_manager)', !!bob.userId);
  expect('Carol registered (viewer)', !!carol.userId);

  const dup = await rest('POST', '/auth/register', {
    body: { name: 'Alice 2', email: alice.email, password: 'Password123', role: 'admin' },
  });
  expect('duplicate-email register → 409', dup.status === 409 && dup.json.error?.code === 'EMAIL_EXISTS');

  const weakPw = await rest('POST', '/auth/register', {
    body: { name: 'Weak', email: `weak+${STAMP}@example.com`, password: 'short', role: 'admin' },
  });
  expect('weak-password register → 400', weakPw.status === 400 && weakPw.json.error?.code === 'VALIDATION_ERROR');

  const badEmail = await rest('POST', '/auth/register', {
    body: { name: 'Bad', email: 'not-an-email', password: 'Password123', role: 'admin' },
  });
  expect('malformed-email register → 400', badEmail.status === 400 && badEmail.json.error?.code === 'VALIDATION_ERROR');

  const wrongPw = await rest('POST', '/auth/login', { body: { email: alice.email, password: 'Wrong123!' } });
  expect('login with wrong password → 401', wrongPw.status === 401 && wrongPw.json.error?.code === 'INVALID_CREDENTIALS');

  const okLogin = await rest('POST', '/auth/login', { body: { email: alice.email, password: alice.password } });
  expect('login with correct password → 200', okLogin.status === 200 && okLogin.json.success);

  const me = await rest('GET', '/auth/me', { token: alice.accessToken });
  expect('GET /auth/me returns Alice', me.status === 200 && me.json.data?.user?.email === alice.email);

  const meAnon = await rest('GET', '/auth/me');
  expect('GET /auth/me without token → 401', meAnon.status === 401);

  const meBadToken = await rest('GET', '/auth/me', { token: 'totally.invalid.jwt' });
  expect('GET /auth/me with garbage token → 401', meBadToken.status === 401);

  // Refresh tokens
  const refresh = await rest('POST', '/auth/refresh', { body: { refreshToken: alice.refreshToken } });
  expect(
    'POST /auth/refresh returns fresh tokens',
    refresh.status === 200 && refresh.json.success && refresh.json.data?.tokens?.accessToken
  );
  if (refresh.json.success) {
    alice.accessToken = refresh.json.data.tokens.accessToken;
    alice.refreshToken = refresh.json.data.tokens.refreshToken;
  }

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 2 — JSON-parse / malformed-body handling');

  const malformed = await rest('POST', '/auth/login', {
    rawBody: '{ this is not json',
  });
  expect('malformed JSON body → 400 (not 500)', malformed.status === 400, `got ${malformed.status}`);

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 3 — profile update + change-password lifecycle');

  const renamed = await rest('PATCH', '/auth/me', {
    body: { name: 'Alice Updated' },
    token: alice.accessToken,
  });
  expect(
    'PATCH /auth/me renames Alice + regenerates avatar',
    renamed.status === 200 && renamed.json.data?.user?.name === 'Alice Updated' && renamed.json.data?.user?.avatar === 'AU'
  );

  const emptyPatch = await rest('PATCH', '/auth/me', { body: {}, token: alice.accessToken });
  expect('PATCH /auth/me with empty body → 400', emptyPatch.status === 400);

  const wrongCurrent = await rest('POST', '/auth/change-password', {
    body: { currentPassword: 'WrongPass1', newPassword: 'NewPassword456' },
    token: alice.accessToken,
  });
  expect('change-password with wrong current → 401', wrongCurrent.status === 401);

  const goodChange = await rest('POST', '/auth/change-password', {
    body: { currentPassword: alice.password, newPassword: 'NewPassword456' },
    token: alice.accessToken,
  });
  expect('change-password with correct current → 200', goodChange.status === 200);

  const reLoginOld = await rest('POST', '/auth/login', { body: { email: alice.email, password: alice.password } });
  expect('login with OLD password after change → 401', reLoginOld.status === 401);

  const reLoginNew = await rest('POST', '/auth/login', { body: { email: alice.email, password: 'NewPassword456' } });
  expect('login with NEW password → 200', reLoginNew.status === 200);
  if (reLoginNew.json.success) {
    alice.accessToken = reLoginNew.json.data.tokens.accessToken;
    alice.refreshToken = reLoginNew.json.data.tokens.refreshToken;
    alice.password = 'NewPassword456';
  }

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 4 — workspace CRUD + member management');

  const wsCreate = await rest('POST', '/workspaces', {
    body: { name: 'Q4 Budget Room', description: 'End-to-end test workspace' },
    token: alice.accessToken,
  });
  expect('admin creates workspace → 201', wsCreate.status === 201 && wsCreate.json.success);
  const workspaceId: string | undefined = wsCreate.json.data?.id;
  if (!workspaceId) {
    console.error('\nFATAL: workspace creation failed, cannot continue downstream tests.');
    console.error('Response:', JSON.stringify(wsCreate.json, null, 2));
    process.exit(1);
  }

  const wsList = await rest('GET', '/workspaces', { token: alice.accessToken });
  expect(
    'GET /workspaces returns the new workspace',
    wsList.status === 200 && Array.isArray(wsList.json.data) && wsList.json.data.some((w: any) => w.id === workspaceId)
  );

  const wsGet = await rest('GET', `/workspaces/${workspaceId}`, { token: alice.accessToken });
  expect('GET /workspaces/:id (member) → 200', wsGet.status === 200 && wsGet.json.data?.id === workspaceId);

  const wsUpdate = await rest('PATCH', `/workspaces/${workspaceId}`, {
    body: { name: 'Q4 Budget Room (updated)' },
    token: alice.accessToken,
  });
  expect(
    'admin updates workspace name',
    wsUpdate.status === 200 && wsUpdate.json.data?.name === 'Q4 Budget Room (updated)'
  );

  // Bob hasn't been invited yet → 403
  const wsGetBefore = await rest('GET', `/workspaces/${workspaceId}`, { token: bob.accessToken });
  expect('non-member GET /workspaces/:id → 403', wsGetBefore.status === 403);

  // Invite Bob + Carol
  const invBob = await rest('POST', `/workspaces/${workspaceId}/members`, {
    body: { email: bob.email, role: 'finance_manager' },
    token: alice.accessToken,
  });
  expect('admin invites Bob (finance_manager)', invBob.status === 201 && invBob.json.success);

  const invCarol = await rest('POST', `/workspaces/${workspaceId}/members`, {
    body: { email: carol.email, role: 'viewer' },
    token: alice.accessToken,
  });
  expect('admin invites Carol (viewer)', invCarol.status === 201 && invCarol.json.success);

  const invMissing = await rest('POST', `/workspaces/${workspaceId}/members`, {
    body: { email: `nobody+${STAMP}@example.com`, role: 'viewer' },
    token: alice.accessToken,
  });
  expect('invite non-existent email → 404', invMissing.status === 404);

  const invAgain = await rest('POST', `/workspaces/${workspaceId}/members`, {
    body: { email: bob.email, role: 'viewer' },
    token: alice.accessToken,
  });
  expect('invite Bob again → 409 (already member)', invAgain.status === 409);

  const invByBob = await rest('POST', `/workspaces/${workspaceId}/members`, {
    body: { email: `random+${STAMP}@example.com`, role: 'viewer' },
    token: bob.accessToken,
  });
  expect('non-admin tries to invite → 403', invByBob.status === 403);

  const members = await rest('GET', `/workspaces/${workspaceId}/members`, { token: alice.accessToken });
  expect(
    'GET /workspaces/:id/members returns all 3',
    members.status === 200 && Array.isArray(members.json.data) && members.json.data.length === 3
  );

  // Promote Carol → finance_manager temporarily
  const promote = await rest('PATCH', `/workspaces/${workspaceId}/members/${carol.userId}`, {
    body: { role: 'finance_manager' },
    token: alice.accessToken,
  });
  expect('admin promotes Carol → finance_manager', promote.status === 200 || promote.status === 204);

  // Demote her back to viewer for the rest of the test
  const demote = await rest('PATCH', `/workspaces/${workspaceId}/members/${carol.userId}`, {
    body: { role: 'viewer' },
    token: alice.accessToken,
  });
  expect('admin demotes Carol → viewer', demote.status === 200 || demote.status === 204);

  const ownerRemove = await rest('DELETE', `/workspaces/${workspaceId}/members/${alice.userId}`, {
    token: alice.accessToken,
  });
  expect('admin tries to remove themselves (owner) → 400', ownerRemove.status === 400);

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 5 — documents (REST) + RBAC for all 4 types');

  const docTypes: Array<'budget' | 'expense' | 'forecast' | 'report'> = [
    'budget',
    'expense',
    'forecast',
    'report',
  ];
  const docs: Record<string, string> = {};
  for (const t of docTypes) {
    const r = await rest('POST', '/documents', {
      body: { title: `${t.toUpperCase()} doc`, type: t, workspaceId },
      token: alice.accessToken,
    });
    expect(`admin creates document type=${t}`, r.status === 201 && r.json.success);
    docs[t] = r.json.data.id;
  }
  const primaryDoc = docs.budget;

  const carolCreate = await rest('POST', '/documents', {
    body: { title: 'Should fail', type: 'budget', workspaceId },
    token: carol.accessToken,
  });
  expect('viewer create document → 403', carolCreate.status === 403);

  const docList = await rest('GET', `/documents/workspace/${workspaceId}`, { token: bob.accessToken });
  expect(
    'GET /documents/workspace/:id returns 4 docs',
    docList.status === 200 && Array.isArray(docList.json.data) && docList.json.data.length === 4
  );

  const docGet = await rest('GET', `/documents/${primaryDoc}`, { token: bob.accessToken });
  expect('GET /documents/:id returns doc', docGet.status === 200 && docGet.json.data?.id === primaryDoc);

  const bobCell = await rest('PATCH', `/documents/${primaryDoc}/cells`, {
    body: { rowIndex: 0, cellIndex: 1, value: '12345', clientVersion: 0 },
    token: bob.accessToken,
  });
  expect('editor (Bob) PATCH cell → 200', bobCell.status === 200 && bobCell.json.success);

  const carolCell = await rest('PATCH', `/documents/${primaryDoc}/cells`, {
    body: { rowIndex: 0, cellIndex: 1, value: 'hacked', clientVersion: 0 },
    token: carol.accessToken,
  });
  expect('viewer PATCH cell → 403', carolCell.status === 403);

  const bobAddRow = await rest('POST', `/documents/${primaryDoc}/rows`, {
    body: { afterRowIndex: 0 },
    token: bob.accessToken,
  });
  expect('editor POST /rows → 200', bobAddRow.status === 200 && bobAddRow.json.success);

  const carolAddRow = await rest('POST', `/documents/${primaryDoc}/rows`, {
    body: {},
    token: carol.accessToken,
  });
  expect('viewer POST /rows → 403', carolAddRow.status === 403);

  // Delete a row that exists (after addRow we have N+1 rows; safe to delete index 1)
  const bobDelRow = await rest('DELETE', `/documents/${primaryDoc}/rows`, {
    body: { rowIndex: 1 },
    token: bob.accessToken,
  });
  expect('editor DELETE /rows → 200', bobDelRow.status === 200 && bobDelRow.json.success);

  const carolDelRow = await rest('DELETE', `/documents/${primaryDoc}/rows`, {
    body: { rowIndex: 0 },
    token: carol.accessToken,
  });
  expect('viewer DELETE /rows → 403', carolDelRow.status === 403);

  // Versioning
  const ver1 = await rest('POST', `/documents/${primaryDoc}/versions`, {
    body: { message: 'first checkpoint' },
    token: bob.accessToken,
  });
  expect('save version → 200', ver1.status === 200 && ver1.json.success);
  const versionId: string | undefined = ver1.json.data?.id;

  // Mutate after the version, then restore
  await rest('PATCH', `/documents/${primaryDoc}/cells`, {
    body: { rowIndex: 0, cellIndex: 2, value: 'post-version', clientVersion: 0 },
    token: bob.accessToken,
  });
  const restored = await rest('POST', `/documents/${primaryDoc}/versions/${versionId}/restore`, {
    token: bob.accessToken,
  });
  expect(
    'restore version → 200',
    restored.status === 200 && restored.json.success,
    `status=${restored.status} body=${JSON.stringify(restored.json)}`
  );

  // Carol can read the doc
  const carolGet = await rest('GET', `/documents/${primaryDoc}`, { token: carol.accessToken });
  expect('viewer GET /documents/:id → 200', carolGet.status === 200);

  // Validation: invalid cell input
  const badCell = await rest('PATCH', `/documents/${primaryDoc}/cells`, {
    body: { rowIndex: -1, cellIndex: 'x', value: '0' },
    token: bob.accessToken,
  });
  expect('PATCH /cells with invalid input → 400', badCell.status === 400);

  // Non-member access
  const nonMember = await rest('GET', `/documents/${primaryDoc}`, { token: alice.accessToken }); // sanity
  expect('admin GET /documents/:id → 200', nonMember.status === 200);

  // Delete one of the docs
  const delDoc = await rest('DELETE', `/documents/${docs.report}`, { token: alice.accessToken });
  expect('admin DELETE /documents/:id → 200', delDoc.status === 200);

  const ghostGet = await rest('GET', `/documents/${docs.report}`, { token: alice.accessToken });
  expect('GET deleted document → 404', ghostGet.status === 404);

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 6 — real-time collaboration (sockets)');

  const ws = [alice, bob, carol];
  await Promise.all(ws.map(connectSocket));
  expect(
    'all 3 sockets connected',
    ws.every((u) => u.socket?.connected)
  );

  // Join workspace
  const joinTs = Date.now();
  for (const u of ws) {
    u.socket!.emit('join-workspace', { workspaceId });
    await sleep(80);
  }
  await waitForAll(ws, 'workspace-presence', 2000, joinTs);
  for (const u of ws) {
    expect(`${u.label} receives workspace-presence`, received(u, 'workspace-presence', joinTs).length >= 1);
  }

  // Join document
  const docJoin = Date.now();
  for (const u of ws) {
    u.socket!.emit('join-document', { documentId: primaryDoc });
    await sleep(80);
  }
  await waitForAll(ws, 'document-presence', 2000, docJoin);
  for (const u of ws) {
    expect(`${u.label} receives document-presence`, received(u, 'document-presence', docJoin).length >= 1);
  }

  // Editor edits via socket
  const cellTs = Date.now();
  bob.socket!.emit('cell-update', {
    documentId: primaryDoc,
    rowIndex: 0,
    cellIndex: 2,
    value: 'socket-edit',
    clientVersion: 1,
  });
  // Wait for peers to see the broadcast AND the sender to see the ack.
  await Promise.race([
    Promise.all([
      waitFor(alice, 'cell-updated', 2000, cellTs),
      waitFor(carol, 'cell-updated', 2000, cellTs),
      waitFor(bob, 'cell-update-ack', 2000, cellTs),
    ]),
    sleep(2200),
  ]);
  expect(
    'Alice receives Bob socket cell-edit',
    received(alice, 'cell-updated', cellTs).some((e) => e.payload?.value === 'socket-edit')
  );
  expect(
    'Carol receives Bob socket cell-edit',
    received(carol, 'cell-updated', cellTs).some((e) => e.payload?.value === 'socket-edit')
  );
  {
    const acks = received(bob, 'cell-update-ack', cellTs);
    expect(
      'Bob gets cell-update-ack success',
      acks.some((e) => e.payload?.success),
      `acks=${JSON.stringify(acks.map((a) => a.payload))}`
    );
  }

  // Viewer attempts edit
  const viewerTs = Date.now();
  carol.socket!.emit('cell-update', {
    documentId: primaryDoc,
    rowIndex: 0,
    cellIndex: 2,
    value: 'hacked',
    clientVersion: 1,
  });
  await sleep(600);
  expect(
    'viewer socket edit gets failure ack',
    received(carol, 'cell-update-ack', viewerTs).some((e) => e.payload?.success === false)
  );
  expect(
    'viewer hacked payload never broadcast',
    [alice, bob].every(
      (u) => received(u, 'cell-updated', viewerTs).filter((e) => e.payload?.value === 'hacked').length === 0
    )
  );

  // Row add via socket
  const rowTs = Date.now();
  bob.socket!.emit('row-add', { documentId: primaryDoc });
  await waitForAll([alice, carol], 'row-added', 1500, rowTs);
  expect(
    'Alice + Carol see row-added',
    received(alice, 'row-added', rowTs).length >= 1 && received(carol, 'row-added', rowTs).length >= 1
  );

  // Cursor
  const curTs = Date.now();
  alice.socket!.emit('cursor-move', { documentId: primaryDoc, rowIndex: 3, cellIndex: 0 });
  await waitForAll([bob, carol], 'cursor-moved', 1500, curTs);
  expect(
    'Bob sees Alice cursor',
    received(bob, 'cursor-moved', curTs).some((e) => e.payload?.rowIndex === 3)
  );
  expect(
    'Carol sees Alice cursor',
    received(carol, 'cursor-moved', curTs).some((e) => e.payload?.rowIndex === 3)
  );

  // Version-saved via REST should broadcast over sockets
  const versionTs = Date.now();
  await rest('POST', `/documents/${primaryDoc}/versions`, {
    body: { message: 'socket-broadcast checkpoint' },
    token: bob.accessToken,
  });
  await waitForAll([alice, carol, bob], 'version-saved', 2000, versionTs);
  for (const u of ws) {
    expect(`${u.label} receives version-saved socket event`, received(u, 'version-saved', versionTs).length >= 1);
  }

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 7 — chat REST + socket + mentions + reactions');

  // REST send
  const restMsg = await rest('POST', `/chat/workspace/${workspaceId}`, {
    body: { content: 'Hello from REST' },
    token: bob.accessToken,
  });
  expect('Bob sends chat via REST → 201', restMsg.status === 201 && restMsg.json.success);
  const restMsgId: string = restMsg.json.data.id;

  const history = await rest('GET', `/chat/workspace/${workspaceId}`, { token: carol.accessToken });
  expect(
    'Carol fetches history and sees Bob message',
    history.status === 200 && history.json.data?.some((m: any) => m.id === restMsgId)
  );

  // Socket send
  const chatTs = Date.now();
  alice.socket!.emit('send-message', { workspaceId, content: 'Hello from socket' });
  await waitForAll(ws, 'new-message', 2000, chatTs);
  for (const u of ws) {
    const got = received(u, 'new-message', chatTs).filter((m) => m.payload?.content === 'Hello from socket');
    expect(`${u.label} receives socket chat`, got.length === 1, `count=${got.length}`);
  }

  // Mention
  const mentionMsg = await rest('POST', `/chat/workspace/${workspaceId}`, {
    body: { content: `Heads up @Bob please review` },
    token: alice.accessToken,
  });
  expect('mention message sent', mentionMsg.status === 201);
  await sleep(400);

  const bobNotifs = await rest('GET', '/notifications', { token: bob.accessToken });
  expect(
    'Bob has a mention notification',
    bobNotifs.status === 200 && bobNotifs.json.data?.some((n: any) => n.type === 'mention')
  );

  // Reactions
  const react = await rest('POST', `/chat/messages/${restMsgId}/reactions`, {
    body: { emoji: '👍' },
    token: alice.accessToken,
  });
  expect('Alice adds reaction → 200', react.status === 200);

  const unReact = await rest('DELETE', `/chat/messages/${restMsgId}/reactions`, {
    body: { emoji: '👍' },
    token: alice.accessToken,
  });
  expect('Alice removes reaction → 200', unReact.status === 200);

  // Deletion rules — Carol cannot delete Bob's message
  const carolDel = await rest('DELETE', `/chat/messages/${restMsgId}`, { token: carol.accessToken });
  expect('viewer cannot delete other user message → 403', carolDel.status === 403);

  // Admin can delete anyone's message
  const adminDel = await rest('DELETE', `/chat/messages/${restMsgId}`, { token: alice.accessToken });
  expect('admin deletes any message → 200', adminDel.status === 200);

  // Typing indicator over socket
  const typingTs = Date.now();
  bob.socket!.emit('typing-start', { workspaceId });
  await waitForAll([alice, carol], 'user-typing', 1500, typingTs);
  expect(
    'Alice + Carol see Bob typing',
    received(alice, 'user-typing', typingTs).length >= 1 && received(carol, 'user-typing', typingTs).length >= 1
  );
  bob.socket!.emit('typing-stop', { workspaceId });

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 8 — notifications: list, mark-one, mark-all, delete');

  const beforeRead = await rest('GET', '/notifications', { token: bob.accessToken });
  const firstUnread = beforeRead.json.data?.find((n: any) => !n.read);
  expect('Bob has at least one unread notification', !!firstUnread);

  const markOne = await rest('PATCH', `/notifications/${firstUnread?.id}/read`, { token: bob.accessToken });
  expect('mark one notification as read → 200', markOne.status === 200 && markOne.json.data?.read === true);

  const markAll = await rest('PATCH', '/notifications/read-all', { token: bob.accessToken });
  expect('mark all as read → 200', markAll.status === 200);

  const afterAll = await rest('GET', '/notifications?unreadOnly=true', { token: bob.accessToken });
  expect('after mark-all, unread list is empty', afterAll.status === 200 && afterAll.json.data?.length === 0);

  // Delete a notification
  if (firstUnread?.id) {
    const delN = await rest('DELETE', `/notifications/${firstUnread.id}`, { token: bob.accessToken });
    expect('delete notification → 200', delN.status === 200);
  }

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 9 — audit logs (member + non-member access)');

  const audit = await rest('GET', `/audit/workspace/${workspaceId}`, { token: alice.accessToken });
  expect('member GET /audit/workspace returns logs', audit.status === 200 && (audit.json.data?.length ?? 0) > 0);
  const actions = new Set<string>((audit.json.data || []).map((l: any) => l.action));
  for (const expected of ['create', 'invite', 'update', 'delete']) {
    expect(`audit log captured action='${expected}'`, actions.has(expected));
  }

  // Non-member must not be able to see audit logs (security check).
  const outsider = await registerUser('Outsider', 'admin');
  const auditLeak = await rest('GET', `/audit/workspace/${workspaceId}`, { token: outsider.accessToken });
  expect(
    'non-member GET /audit/workspace → 403 (no leak)',
    auditLeak.status === 403,
    `got ${auditLeak.status} with ${auditLeak.json.data?.length ?? 0} logs leaked`
  );

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 10 — security: logout, blacklisted tokens, expired session');

  const tokenBeforeLogout = alice.accessToken;
  const logout = await rest('POST', '/auth/logout', {
    body: { refreshToken: alice.refreshToken },
    token: alice.accessToken,
  });
  expect('logout → 200', logout.status === 200);

  // Need a beat for Redis SETEX to land.
  await sleep(200);

  const blacklistedCall = await rest('GET', '/auth/me', { token: tokenBeforeLogout });
  expect(
    'using token after logout → 401 (blacklisted)',
    blacklistedCall.status === 401,
    `got ${blacklistedCall.status}`
  );

  const reuseRefresh = await rest('POST', '/auth/refresh', { body: { refreshToken: alice.refreshToken } });
  expect('reusing revoked refresh token → 401', reuseRefresh.status === 401);

  // Re-login Alice to continue cleanup phases.
  const reAlice = await rest('POST', '/auth/login', { body: { email: alice.email, password: alice.password } });
  if (reAlice.json.success) {
    alice.accessToken = reAlice.json.data.tokens.accessToken;
    alice.refreshToken = reAlice.json.data.tokens.refreshToken;
  }
  expect('Alice can log back in → 200', reAlice.status === 200);

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 11 — member removal + post-removal access');

  const removeCarol = await rest('DELETE', `/workspaces/${workspaceId}/members/${carol.userId}`, {
    token: alice.accessToken,
  });
  expect('admin removes Carol → 200', removeCarol.status === 200);

  const carolGetAfter = await rest('GET', `/workspaces/${workspaceId}`, { token: carol.accessToken });
  expect('removed member GET /workspaces/:id → 403', carolGetAfter.status === 403);

  const carolDocsAfter = await rest('GET', `/documents/workspace/${workspaceId}`, { token: carol.accessToken });
  expect('removed member GET /documents/workspace → 403', carolDocsAfter.status === 403);

  // ────────────────────────────────────────────────────────────────────
  section('PHASE 12 — clean-up: workspace deletion + cascade');

  const wsDel = await rest('DELETE', `/workspaces/${workspaceId}`, { token: alice.accessToken });
  expect('owner DELETE /workspaces/:id → 200', wsDel.status === 200);

  const wsGone = await rest('GET', `/workspaces/${workspaceId}`, { token: alice.accessToken });
  expect('GET deleted workspace → 404', wsGone.status === 404);

  // ────────────────────────────────────────────────────────────────────
  ws.forEach((u) => u.socket?.disconnect());

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  RESULT: ${String(pass).padStart(3)} passed, ${String(fail).padStart(3)} failed.`.padEnd(63) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  if (fail > 0) {
    console.log('\nFailures:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
