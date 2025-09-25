import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

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

interface StoredUserRecord extends UserRecord {
  passwordHash: string;
}

interface StoreShape {
  users: StoredUserRecord[];
  actions: UserActionRecord[];
}

export interface CreateUserInput {
  email: string;
  name: string;
  department: string;
  role: UserRole;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  department?: string;
  role?: UserRole;
  password?: string;
}

const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIRECTORY, 'users.json');
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEYLEN = 64;

const scrypt = promisify(scryptCallback);

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
  const parsedUsers = Array.isArray(parsed.users)
    ? (parsed.users as Partial<StoredUserRecord>[])
    : [];

  const users: StoredUserRecord[] = parsedUsers
    .filter((user) => {
      if (!user) return false;
      const hasCoreFields =
        typeof user.id === 'string' &&
        typeof user.email === 'string' &&
        typeof user.name === 'string' &&
        typeof user.department === 'string' &&
        (user.role === 'admin' || user.role === 'user') &&
        typeof user.createdAt === 'string' &&
        typeof user.updatedAt === 'string';
      return hasCoreFields;
    })
    .map((user) => ({
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
      department: user.department as string,
      role: user.role as UserRole,
      createdAt: user.createdAt as string,
      updatedAt: user.updatedAt as string,
      lastLoginAt:
        typeof user.lastLoginAt === 'string' ? user.lastLoginAt : undefined,
      passwordHash:
        typeof user.passwordHash === 'string' ? user.passwordHash : '',
    }));

  return {
    users,
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

async function writeStore(store: StoreShape): Promise<void> {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function sortByUpdatedAt(users: StoredUserRecord[]): StoredUserRecord[] {
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

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derived = (await scrypt(password, salt, PASSWORD_KEYLEN)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const [saltHex, keyHex] = hash.split(':');
  if (!saltHex || !keyHex) {
    return false;
  }
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}

function sanitizeUser(record: StoredUserRecord): UserRecord {
  const { passwordHash: _ignored, ...publicUser } = record;
  void _ignored;
  return publicUser;
}

export async function listUsers(): Promise<UserRecord[]> {
  const store = await readStore();
  return sortByUpdatedAt(store.users).map(sanitizeUser);
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
  const record = store.users.find((user) => user.id === id);
  return record ? sanitizeUser(record) : null;
}

export async function getUserByEmail(
  email: string
): Promise<UserRecord | null> {
  const store = await readStore();
  const record = store.users.find(
    (user) => user.email.toLowerCase() === email.toLowerCase()
  );
  return record ? sanitizeUser(record) : null;
}

function getActor(actor: ActionActor | null): ActionActor | null {
  if (!actor) return null;
  return {
    id: actor.id,
    email: actor.email ?? null,
    name: actor.name ?? null,
  };
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
  const passwordHash = await hashPassword(input.password);
  const record: StoredUserRecord = {
    id: randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name,
    department: input.department,
    role: input.role,
    createdAt: now,
    updatedAt: now,
    passwordHash,
  };

  store.users.push(record);
  store.actions.push(
    createAction({
      userId: record.id,
      actor: getActor(actor),
      type: 'created',
      summary: `${actor?.email ?? 'system'} created user ${record.email}`,
      metadata: { user: sanitizeUser(record) },
    })
  );

  await writeStore(store);
  return sanitizeUser(record);
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

  const record = store.users[index];
  const now = new Date().toISOString();
  const changes: string[] = [];

  if (typeof updates.name === 'string' && updates.name !== record.name) {
    record.name = updates.name;
    changes.push('name');
  }

  if (
    typeof updates.department === 'string' &&
    updates.department !== record.department
  ) {
    record.department = updates.department;
    changes.push('department');
  }

  if (updates.role && updates.role !== record.role) {
    record.role = updates.role;
    changes.push('role');
    store.actions.push(
      createAction({
        userId: record.id,
        actor: getActor(actor),
        type: 'role_change',
        summary: `${actor?.email ?? 'system'} changed ${record.email} role to ${updates.role}.`,
        metadata: { role: updates.role },
      })
    );
  }

  if (updates.password) {
    record.passwordHash = await hashPassword(updates.password);
    changes.push('password');
  }

  if (changes.length > 0) {
    record.updatedAt = now;
    const nonRoleChanges = changes.filter((change) => change !== 'role');
    if (nonRoleChanges.length > 0) {
      store.actions.push(
        createAction({
          userId: record.id,
          actor: getActor(actor),
          type: 'updated',
          summary: `${actor?.email ?? 'system'} updated ${record.email} (${nonRoleChanges.join(
            ', '
          )}).`,
          metadata: { changes: nonRoleChanges },
        })
      );
    }
  }

  store.users[index] = record;
  await writeStore(store);
  return sanitizeUser(record);
}

export async function deleteUser(
  id: string,
  actor: ActionActor | null
): Promise<void> {
  const store = await readStore();
  const index = store.users.findIndex((user) => user.id === id);
  if (index === -1) {
    throw new Error('User not found.');
  }

  const [record] = store.users.splice(index, 1);
  store.actions = store.actions.filter((action) => action.userId !== id);
  store.actions.push(
    createAction({
      userId: record.id,
      actor: getActor(actor),
      type: 'deleted',
      summary: `${actor?.email ?? 'system'} deleted user ${record.email}`,
    })
  );

  await writeStore(store);
}

export async function authenticateUserWithPassword(
  email: string,
  password: string
): Promise<UserRecord | null> {
  const store = await readStore();
  const record = store.users.find(
    (candidate) => candidate.email.toLowerCase() === email.toLowerCase()
  );
  if (!record) {
    return null;
  }

  const passwordValid = await verifyPassword(password, record.passwordHash);
  if (!passwordValid) {
    return null;
  }

  record.lastLoginAt = new Date().toISOString();
  store.actions.push(
    createAction({
      userId: record.id,
      actor: { id: record.id, email: record.email, name: record.name },
      type: 'login',
      summary: `${record.email} signed in.`,
    })
  );

  await writeStore(store);
  return sanitizeUser(record);
}
