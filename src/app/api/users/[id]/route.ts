import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import {
  deleteUser,
  getUserById,
  listActionsForUser,
  updateUser,
  type UpdateUserInput,
  type UserRole,
} from '@/lib/persistence/users';

interface AdminActor {
  id: string;
  email: string | null;
  name: string | null;
}

function ensureAdmin(
  session: Awaited<ReturnType<typeof getServerSession>>
): AdminActor {
  if (!session?.user) {
    const error = new Error('Unauthorized');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  if (session.user.role !== 'admin') {
    const error = new Error('Forbidden');
    (error as Error & { status?: number }).status = 403;
    throw error;
  }

  const adminId = session.user.id;
  if (!adminId) {
    const error = new Error('Unauthorized');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  return {
    id: adminId,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}

function canViewUser(
  session: Awaited<ReturnType<typeof getServerSession>>,
  userId: string
): boolean {
  if (!session?.user) return false;
  if (session.user.role === 'admin') return true;
  return session.user.id === userId;
}

function parseRole(input: unknown): UserRole | undefined {
  if (input === undefined) return undefined;
  if (input === 'admin' || input === 'user') {
    return input;
  }
  throw new Error('Invalid role value.');
}

async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch (error) {
    console.error('Failed to parse request body', error);
    throw new Error('Invalid JSON payload.');
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!canViewUser(session, id)) {
    const status = session?.user ? 403 : 401;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }

  const user = await getUserById(id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const actions = await listActionsForUser(user.id);
  return NextResponse.json({ user, actions });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  let actor: AdminActor;
  try {
    actor = ensureAdmin(session);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }

  let payload: Partial<UpdateUserInput> & { role?: unknown };
  try {
    payload = await readJson(request);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  let role: UserRole | undefined;
  try {
    role = parseRole(payload.role);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  let password: string | undefined;
  if (payload.password !== undefined) {
    if (typeof payload.password !== 'string') {
      return NextResponse.json(
        { error: 'Password must be a string.' },
        { status: 400 }
      );
    }
    if (payload.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }
    password = payload.password;
  }

  const updates: UpdateUserInput = {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    department:
      typeof payload.department === 'string' ? payload.department : undefined,
    role,
    password,
  };

  try {
    const user = await updateUser(id, updates, actor);
    const actions = await listActionsForUser(user.id);
    return NextResponse.json({ user, actions });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  let actor: AdminActor;
  try {
    actor = ensureAdmin(session);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }

  try {
    await deleteUser(id, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
