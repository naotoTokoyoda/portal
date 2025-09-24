import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import {
  createUser,
  listActions,
  listActionsForUser,
  listUsers,
  type CreateUserInput,
  type UserRole,
} from '@/lib/persistence/users';

interface AdminActor {
  id: string;
  email: string | null;
  name: string | null;
}

function assertAdmin(
  session: Awaited<ReturnType<typeof getServerSession>>
): AdminActor {
  if (!session?.user) {
    throw new Error('Unauthorized');
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

function parseRole(input: unknown): UserRole {
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

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    assertAdmin(session);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }

  const includeHistory =
    request.nextUrl.searchParams.get('includeHistory') === '1';
  const users = await listUsers();
  if (!includeHistory) {
    return NextResponse.json({ users });
  }

  const actions = await listActions();
  return NextResponse.json({ users, actions });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  let actor: AdminActor;
  try {
    actor = assertAdmin(session);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }

  let payload: Partial<CreateUserInput> & { role?: unknown };
  try {
    payload = await readJson(request);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  if (!payload.email || typeof payload.email !== 'string') {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  if (!payload.name || typeof payload.name !== 'string') {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }

  if (!payload.department || typeof payload.department !== 'string') {
    return NextResponse.json(
      { error: 'Department is required.' },
      { status: 400 }
    );
  }

  let role: UserRole;
  try {
    role = parseRole(payload.role);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  try {
    const user = await createUser(
      {
        email: payload.email,
        name: payload.name,
        department: payload.department,
        role,
      },
      actor
    );

    const actions = await listActionsForUser(user.id);
    return NextResponse.json({ user, actions }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
