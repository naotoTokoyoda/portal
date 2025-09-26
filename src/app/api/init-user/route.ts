import { NextRequest, NextResponse } from 'next/server';
import { logAccess, logAudit } from '@/lib/logging';
import { createUser } from '@/lib/persistence/users';

export async function POST(request: NextRequest) {
  try {
    // Create a test admin user
    const testUser = await createUser(
      {
        email: 'admin@example.com',
        password: 'password123',
        name: 'Test Admin',
        department: 'Engineering',
        role: 'admin',
      },
      null // No actor for initial user creation
    );

    await logAccess({
      actorId: null,
      actorRole: null,
      actorDepartment: null,
      actorIp:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.ip ??
        null,
      method: request.method,
      resource: '/api/init-user',
      statusCode: 200,
      userAgent: request.headers.get('user-agent'),
      metadata: { createdUserId: testUser.id },
    });

    await logAudit({
      action: 'bootstrap.admin',
      actorId: null,
      actorRole: null,
      targetId: testUser.id,
      description: 'Initialized default admin user',
      metadata: { email: testUser.email },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        department: testUser.department,
      },
    });
  } catch (error) {
    console.error('Error creating initial user:', error);
    await logAccess({
      actorId: null,
      actorRole: null,
      actorDepartment: null,
      actorIp:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.ip ??
        null,
      method: request.method,
      resource: '/api/init-user',
      statusCode: 500,
      userAgent: request.headers.get('user-agent'),
      metadata: { outcome: 'bootstrap-error' },
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create initial user' },
      { status: 500 }
    );
  }
}
