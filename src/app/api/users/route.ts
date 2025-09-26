import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { logAccess, logAudit } from '@/lib/logging';
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
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    null;
  const userAgent = request.headers.get('user-agent');
  try {
    assertAdmin(session);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    await logAccess({
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: status,
      userAgent,
      metadata: { outcome: 'access-denied' },
    });
    return NextResponse.json({ error: (error as Error).message }, { status });
  }

  const includeHistory =
    request.nextUrl.searchParams.get('includeHistory') === '1';
  const users = await listUsers();
  if (!includeHistory) {
    await logAccess({
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 200,
      userAgent,
      metadata: { includeHistory: false },
    });
    return NextResponse.json({ users });
  }

  const actions = await listActions();
  await logAccess({
    actorId: session?.user?.id,
    actorRole: session?.user?.role,
    actorDepartment: session?.user?.department,
    actorIp: clientIp,
    method: request.method,
    resource: '/api/users',
    statusCode: 200,
    userAgent,
    metadata: { includeHistory: true },
  });
  return NextResponse.json({ users, actions });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.ip ??
    null;
  const userAgent = request.headers.get('user-agent');
  let actor: AdminActor;
  try {
    actor = assertAdmin(session);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 401;
    await logAccess({
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: status,
      userAgent,
      metadata: { outcome: 'access-denied' },
    });
    return NextResponse.json({ error: (error as Error).message }, { status });
  }

  let payload: Partial<CreateUserInput> & { role?: unknown };
  try {
    payload = await readJson(request);
  } catch (error) {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'invalid-json' },
    });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  if (!payload.email || typeof payload.email !== 'string') {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'missing-email' },
    });
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  if (!payload.name || typeof payload.name !== 'string') {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'missing-name' },
    });
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }

  if (!payload.department || typeof payload.department !== 'string') {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'missing-department' },
    });
    return NextResponse.json(
      { error: 'Department is required.' },
      { status: 400 }
    );
  }

  if (!payload.password || typeof payload.password !== 'string') {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'missing-password' },
    });
    return NextResponse.json(
      { error: 'Password is required.' },
      { status: 400 }
    );
  }

  if (payload.password.length < 8) {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'password-too-short' },
    });
    return NextResponse.json(
      { error: 'Password must be at least 8 characters long.' },
      { status: 400 }
    );
  }

  let role: UserRole;
  try {
    role = parseRole(payload.role);
  } catch (error) {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'invalid-role' },
    });
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
        password: payload.password,
      },
      actor
    );

    const actions = await listActionsForUser(user.id);

    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 201,
      userAgent,
      metadata: { createdUserId: user.id },
    });

    await logAudit({
      action: 'user.create',
      actorId: actor.id,
      actorRole: session?.user?.role,
      targetId: user.id,
      description: `Created user ${user.email}`,
      metadata: {
        department: user.department,
        accessHistoryEntries: actions.length,
      },
    });

    return NextResponse.json({ user, actions }, { status: 201 });
  } catch (error) {
    await logAccess({
      actorId: actor.id,
      actorRole: session?.user?.role,
      actorDepartment: session?.user?.department,
      actorIp: clientIp,
      method: request.method,
      resource: '/api/users',
      statusCode: 400,
      userAgent,
      metadata: { outcome: 'create-user-error' },
    });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
