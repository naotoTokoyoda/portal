import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export type UserRole = 'user' | 'admin';

export type UserActionType =
  | 'created'
  | 'updated'
  | 'role_change'
  | 'deleted'
  | 'login';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  department: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface ActionActor {
  id: string;
  email?: string | null;
  name?: string | null;
}

export interface UserActionRecord {
  id: string;
  userId: string;
  actor: ActionActor | null;
  type: UserActionType;
  timestamp: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

interface StoreShape {
  users: UserRecord[];
  actions: UserActionRecord[];
}

export interface CreateUserInput {
  email: string;
  name: string;
  department: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  department?: string;
  role?: UserRole;
}

export interface IdentitySyncInput {
  email: string;
  name?: string | null;
  department?: string | null;
  role?: UserRole;
  provider?: string;
  metadata?: Record<string, unknown>;
}

const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIRECTORY, 'users.json');

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: StoreShape = { users: [], actions: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw) as Partial<StoreShape>;
  return {
    users: parsed.users ?? [],
    actions: parsed.actions ?? [],
  };
}

async function writeStore(store: StoreShape): Promise<void> {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function sortByUpdatedAt(users: UserRecord[]): UserRecord[] {
  return [...users].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function sortActions(actions: UserActionRecord[]): UserActionRecord[] {
  return [...actions].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function createAction(options: {
  userId: string;
  actor: ActionActor | null;
  type: UserActionType;
  summary: string;
  metadata?: Record<string, unknown>;
}): UserActionRecord {
  return {
    id: randomUUID(),
    userId: options.userId,
    actor: options.actor,
    type: options.type,
    timestamp: new Date().toISOString(),
    summary: options.summary,
    metadata: options.metadata,
  };
}

export async function listUsers(): Promise<UserRecord[]> {
  const store = await readStore();
  return sortByUpdatedAt(store.users);
}

export async function listActions(): Promise<UserActionRecord[]> {
  const store = await readStore();
  return sortActions(store.actions);
}

export async function listActionsForUser(
  userId: string
): Promise<UserActionRecord[]> {
  const store = await readStore();
  const actions = store.actions.filter((action) => action.userId === userId);
  return sortActions(actions);
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const store = await readStore();
  return store.users.find((user) => user.id === id) ?? null;
}

export async function getUserByEmail(
  email: string
): Promise<UserRecord | null> {
  const store = await readStore();
  return (
    store.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    ) ?? null
  );
}

export async function createUser(
  input: CreateUserInput,
  actor: ActionActor | null
): Promise<UserRecord> {
  const store = await readStore();
  const existing = store.users.find(
    (user) => user.email.toLowerCase() === input.email.toLowerCase()
  );
  if (existing) {
    throw new Error('A user with this email already exists.');
  }

  const now = new Date().toISOString();
  const record: UserRecord = {
    id: randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name,
    department: input.department,
    role: input.role,
    createdAt: now,
    updatedAt: now,
  };

  store.users.push(record);
  store.actions.push(
    createAction({
      userId: record.id,
      actor,
      type: 'created',
      summary: `${actor?.email ?? 'system'} created user ${record.email}`,
      metadata: { user: record },
    })
  );

  await writeStore(store);
  return record;
}

export async function updateUser(
  id: string,
  updates: UpdateUserInput,
  actor: ActionActor | null
): Promise<UserRecord> {
  const store = await readStore();
  const index = store.users.findIndex((user) => user.id === id);

  if (index === -1) {
    throw new Error('User not found.');
  }

  const current = store.users[index];
  const now = new Date().toISOString();
  const next: UserRecord = {
    ...current,
    name: updates.name ?? current.name,
    department: updates.department ?? current.department,
    role: updates.role ?? current.role,
    updatedAt: now,
  };

  const changes: string[] = [];
  if (next.name !== current.name) changes.push('name');
  if (next.department !== current.department) changes.push('department');
  if (next.role !== current.role) changes.push('role');

  store.users[index] = next;

  if (changes.length > 0) {
    const summary = `${actor?.email ?? 'system'} updated ${changes.join(', ')} for ${next.email}`;
    store.actions.push(
      createAction({
        userId: next.id,
        actor,
        type: changes.includes('role') ? 'role_change' : 'updated',
        summary,
        metadata: { changes },
      })
    );
  }

  await writeStore(store);
  return next;
}

export async function deleteUser(
  id: string,
  actor: ActionActor | null
): Promise<void> {
  const store = await readStore();
  const existing = store.users.find((user) => user.id === id);
  if (!existing) {
    throw new Error('User not found.');
  }

  store.users = store.users.filter((user) => user.id !== id);
  store.actions.push(
    createAction({
      userId: existing.id,
      actor,
      type: 'deleted',
      summary: `${actor?.email ?? 'system'} deleted user ${existing.email}`,
      metadata: { user: existing },
    })
  );

  await writeStore(store);
}

export async function touchUserLogin(userId: string): Promise<UserRecord> {
  const store = await readStore();
  const index = store.users.findIndex((user) => user.id === userId);
  if (index === -1) {
    throw new Error('User not found.');
  }

  const now = new Date().toISOString();
  const current = store.users[index];
  const next: UserRecord = {
    ...current,
    lastLoginAt: now,
    updatedAt: now,
  };

  store.users[index] = next;
  store.actions.push(
    createAction({
      userId: current.id,
      actor: { id: current.id, email: current.email, name: current.name },
      type: 'login',
      summary: `${current.email} signed in via SSO`,
    })
  );

  await writeStore(store);
  return next;
}

export async function upsertUserFromIdentity(
  input: IdentitySyncInput
): Promise<UserRecord> {
  const email = input.email.toLowerCase();
  const store = await readStore();
  const existing = store.users.find((user) => user.email === email);
  const now = new Date().toISOString();

  if (!existing) {
    const record: UserRecord = {
      id: randomUUID(),
      email,
      name: input.name ?? email,
      department: input.department ?? 'General',
      role: input.role ?? 'user',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };

    store.users.push(record);
    store.actions.push(
      createAction({
        userId: record.id,
        actor: { id: record.id, email: record.email, name: record.name },
        type: 'created',
        summary: `SSO created user ${record.email}`,
        metadata: { provider: input.provider, metadata: input.metadata },
      })
    );

    store.actions.push(
      createAction({
        userId: record.id,
        actor: { id: record.id, email: record.email, name: record.name },
        type: 'login',
        summary: `${record.email} signed in via ${input.provider ?? 'SSO'}`,
        metadata: { provider: input.provider },
      })
    );

    await writeStore(store);
    return record;
  }

  const next: UserRecord = {
    ...existing,
    name: input.name ?? existing.name,
    department: input.department ?? existing.department,
    role: input.role ?? existing.role,
    lastLoginAt: now,
    updatedAt: now,
  };

  const changes: string[] = [];
  if (next.department !== existing.department) changes.push('department');
  if (next.role !== existing.role) changes.push('role');
  if (next.name !== existing.name) changes.push('name');

  store.users = store.users.map((user) =>
    user.id === existing.id ? next : user
  );

  if (changes.length > 0) {
    store.actions.push(
      createAction({
        userId: next.id,
        actor: { id: next.id, email: next.email, name: next.name },
        type: changes.includes('role') ? 'role_change' : 'updated',
        summary: `SSO updated ${changes.join(', ')} for ${next.email}`,
        metadata: { provider: input.provider, changes },
      })
    );
  }

  store.actions.push(
    createAction({
      userId: next.id,
      actor: { id: next.id, email: next.email, name: next.name },
      type: 'login',
      summary: `${next.email} signed in via ${input.provider ?? 'SSO'}`,
      metadata: { provider: input.provider },
    })
  );

  await writeStore(store);
  return next;
}
