/**
 * Multi-user real-time collaboration simulation.
 *
 * Simulates 5 browser tabs (Alice = admin, Bob & Carol = finance_manager,
 * Dave & Eve = viewer) all signed-in to the same workspace at the same time.
 *
 * Exercises:
 *   - REST: register × 5, create workspace, invite 4 members, create document.
 *   - Socket.io: 5 concurrent authenticated connections.
 *   - Presence: workspace-presence + user-joined fanout to N-1 peers.
 *   - Chat: send-message fanout to all N peers.
 *   - Typing indicator broadcast.
 *   - Document collab: join-document, cell-update, row-add, cursor-move.
 *   - RBAC: viewer attempts to edit and is rejected by the server.
 *
 * Run with the server already up on :3001 — `npm run multiuser` from server/.
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
  socket: Socket;
  received: { event: string; payload: any; at: number }[];
}

const STAMP = Date.now();
const stripe = (s: string) => `[${s.padEnd(7)}]`;

let pass = 0;
let fail = 0;

function expect(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function postJson(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${REST}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

async function getJson(path: string, token?: string) {
  const headers: Record<string, string> = { Origin: ORIGIN };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${REST}${path}`, { headers });
  return { status: res.status, json: (await res.json()) as any };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function registerUser(label: string, role: UserSession['role']): Promise<UserSession> {
  const email = `${label.toLowerCase()}+${STAMP}@example.com`;
  const password = 'Password123';
  const name = label;

  const { status, json } = await postJson('/auth/register', { name, email, password, role });
  if (status !== 201 || !json.success) {
    throw new Error(`register ${label} failed: ${status} ${JSON.stringify(json)}`);
  }
  return {
    label,
    role,
    email,
    password,
    userId: json.data.user.id,
    accessToken: json.data.tokens.accessToken,
    socket: null as any,
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

    // Capture every server-emitted event for later assertions.
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

async function waitFor(s: UserSession, event: string, ms = 1500, sinceTs = 0) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (received(s, event, sinceTs).length > 0) return true;
    await sleep(25);
  }
  return false;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SyncFinance multi-user collaboration simulation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('▸ Phase 1 — register 5 users (1 admin, 2 editors, 2 viewers)');
  const users: UserSession[] = [];
  users.push(await registerUser('Alice', 'admin'));
  users.push(await registerUser('Bob', 'finance_manager'));
  users.push(await registerUser('Carol', 'finance_manager'));
  users.push(await registerUser('Dave', 'viewer'));
  users.push(await registerUser('Eve', 'viewer'));
  users.forEach((u) =>
    console.log(`  ${stripe(u.role)} ${u.label.padEnd(6)} → ${u.userId}`)
  );

  const [alice, bob, carol, dave, eve] = users;

  console.log('\n▸ Phase 2 — admin creates workspace and invites the other four');
  const wsRes = await postJson(
    '/workspaces',
    { name: 'Q4 Budget Room', description: 'Multi-user collab room' },
    alice.accessToken
  );
  expect('admin creates workspace', wsRes.status === 201 && wsRes.json.success, JSON.stringify(wsRes.json));
  const workspaceId = wsRes.json.data.id;

  for (const u of [bob, carol, dave, eve]) {
    const inv = await postJson(
      `/workspaces/${workspaceId}/members`,
      { email: u.email, role: u.role },
      alice.accessToken
    );
    expect(`invite ${u.label} (${u.role})`, inv.status === 201 && inv.json.success, JSON.stringify(inv.json));
  }

  // Sanity: each invitee should now see the workspace in their listing.
  for (const u of users) {
    const list = await getJson('/workspaces', u.accessToken);
    const has = Array.isArray(list.json.data) && list.json.data.some((w: any) => w.id === workspaceId);
    expect(`${u.label} sees workspace in listing`, has);
  }

  console.log('\n▸ Phase 3 — open 5 socket connections (simulating 5 browser tabs)');
  await Promise.all(users.map((u) => connectSocket(u)));
  users.forEach((u) =>
    expect(`${u.label} socket connected`, u.socket.connected, `id=${u.socket.id}`)
  );

  console.log('\n▸ Phase 4 — all 5 join workspace, verify presence broadcasts');
  const joinTs = Date.now();
  // Stagger joins slightly so each user's user-joined event reaches the others.
  for (const u of users) {
    u.socket.emit('join-workspace', { workspaceId });
    await sleep(120);
  }
  await sleep(500);

  for (const u of users) {
    const ok = await waitFor(u, 'workspace-presence', 1500, joinTs);
    expect(`${u.label} receives workspace-presence`, ok);
  }

  // Each user (except the first) should have heard at least one user-joined
  // from the peers that joined after them.
  for (let i = 0; i < users.length - 1; i++) {
    const u = users[i];
    const joinedEvents = received(u, 'user-joined', joinTs);
    expect(
      `${u.label} sees ${users.length - 1 - i} later joins`,
      joinedEvents.length >= users.length - 1 - i,
      `got ${joinedEvents.length}`
    );
  }

  console.log('\n▸ Phase 5 — chat fanout: Alice sends, everyone receives');
  const chatTs = Date.now();
  alice.socket.emit('send-message', {
    workspaceId,
    content: 'Hi team, kicking off the Q4 review 🚀',
  });
  await sleep(700);

  for (const u of users) {
    const msgs = received(u, 'new-message', chatTs).filter(
      (m) => m.payload?.content?.includes('Q4 review')
    );
    expect(`${u.label} receives Alice's chat message`, msgs.length === 1, `count=${msgs.length}`);
  }

  console.log('\n▸ Phase 6 — typing indicator: Bob types, others see it');
  const typingTs = Date.now();
  bob.socket.emit('typing-start', { workspaceId });
  await sleep(400);

  for (const u of users) {
    if (u.label === 'Bob') continue;
    const ok = await waitFor(u, 'user-typing', 800, typingTs);
    expect(`${u.label} sees Bob typing`, ok);
  }
  bob.socket.emit('typing-stop', { workspaceId });
  await sleep(200);

  console.log('\n▸ Phase 7 — admin creates a doc; all 5 open it');
  const docRes = await postJson(
    '/documents',
    { title: 'Q4 Budget', type: 'budget', workspaceId },
    alice.accessToken
  );
  expect('admin creates document', docRes.status === 201 && docRes.json.success);
  const documentId = docRes.json.data.id;

  const docJoinTs = Date.now();
  for (const u of users) {
    u.socket.emit('join-document', { documentId });
    await sleep(80);
  }
  await sleep(500);

  for (const u of users) {
    const ok = await waitFor(u, 'document-presence', 1500, docJoinTs);
    expect(`${u.label} receives document-presence`, ok);
  }

  console.log('\n▸ Phase 8 — Bob (editor) edits a cell, peers receive cell-updated');
  const cellTs = Date.now();
  bob.socket.emit('cell-update', {
    documentId,
    rowIndex: 0,
    cellIndex: 1,
    value: '15000',
    clientVersion: 1,
  });
  await sleep(700);

  for (const u of users) {
    if (u.label === 'Bob') continue;
    const cells = received(u, 'cell-updated', cellTs).filter(
      (c) => c.payload?.value === '15000' && c.payload?.rowIndex === 0 && c.payload?.cellIndex === 1
    );
    expect(`${u.label} sees Bob's cell edit`, cells.length === 1, `count=${cells.length}`);
  }
  // Sender should get its own ack
  const ack = received(bob, 'cell-update-ack', cellTs);
  expect('Bob receives cell-update-ack', ack.length === 1 && ack[0].payload?.success === true);

  console.log('\n▸ Phase 9 — Bob adds a row, peers see row-added');
  const rowTs = Date.now();
  bob.socket.emit('row-add', { documentId, afterRowIndex: 0 });
  await sleep(700);
  for (const u of users) {
    if (u.label === 'Bob') continue;
    const added = received(u, 'row-added', rowTs);
    expect(`${u.label} sees row-added`, added.length === 1, `count=${added.length}`);
  }

  console.log('\n▸ Phase 10 — Carol moves cursor, peers see cursor-moved');
  const cursorTs = Date.now();
  carol.socket.emit('cursor-move', { documentId, rowIndex: 2, cellIndex: 3 });
  // Wait for all peers to receive the cursor event (Redis adapter + Mongo presence
  // write can add a few hundred ms on a cold cache).
  await Promise.race([
    Promise.all(
      users
        .filter((u) => u.label !== 'Carol')
        .map((u) => waitFor(u, 'cursor-moved', 2000, cursorTs))
    ),
    sleep(2200),
  ]);
  for (const u of users) {
    if (u.label === 'Carol') continue;
    const cur = received(u, 'cursor-moved', cursorTs);
    expect(`${u.label} sees Carol's cursor`, cur.length === 1, `count=${cur.length}`);
  }

  console.log('\n▸ Phase 11 — RBAC: Dave (viewer) tries to edit a cell, server rejects');
  const rbacTs = Date.now();
  dave.socket.emit('cell-update', {
    documentId,
    rowIndex: 0,
    cellIndex: 2,
    value: 'Hacked!',
    clientVersion: 1,
  });
  await sleep(600);
  const daveAck = received(dave, 'cell-update-ack', rbacTs);
  expect(
    'viewer Dave is rejected by server',
    daveAck.length === 1 && daveAck[0].payload?.success === false,
    JSON.stringify(daveAck[0]?.payload)
  );
  // Confirm nobody else saw a cell-updated for the rejected attempt
  let leaked = 0;
  for (const u of users) {
    if (u.label === 'Dave') continue;
    leaked += received(u, 'cell-updated', rbacTs).filter((c) => c.payload?.value === 'Hacked!').length;
  }
  expect('viewer edit is not broadcast', leaked === 0, `leaked=${leaked}`);

  console.log('\n▸ Phase 12 — RBAC: viewer Eve tries to add a row, server rejects');
  const rbacTs2 = Date.now();
  eve.socket.emit('row-add', { documentId });
  await sleep(500);
  const eveAck = received(eve, 'row-add-ack', rbacTs2);
  expect(
    'viewer Eve is rejected by server',
    eveAck.length === 1 && eveAck[0].payload?.success === false
  );

  console.log('\n▸ Phase 13 — Eve disconnects, peers receive user-left');
  const leaveTs = Date.now();
  eve.socket.disconnect();
  await sleep(800);
  for (const u of users) {
    if (u.label === 'Eve') continue;
    const left = received(u, 'user-left', leaveTs);
    expect(`${u.label} notified of Eve leaving`, left.length >= 1, `count=${left.length}`);
  }

  console.log('\n▸ Phase 14 — close remaining sockets');
  users.forEach((u) => {
    if (u.socket.connected) u.socket.disconnect();
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  RESULT: ${pass} passed, ${fail} failed.`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Brief per-user event summary (first 8 events each) for human review.
  console.log('\nPer-user event log (first 8 events captured):');
  for (const u of users) {
    const lines = u.received
      .slice(0, 8)
      .map((r) => `    ${r.event}`)
      .join('\n');
    console.log(`  ${u.label} (${u.role})\n${lines || '    (no events)'}`);
  }

  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
