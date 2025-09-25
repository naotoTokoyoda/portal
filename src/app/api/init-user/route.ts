import { NextResponse } from 'next/server';
import { createUser } from '@/lib/persistence/users';

export async function POST() {
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
    return NextResponse.json(
      { success: false, error: 'Failed to create initial user' },
      { status: 500 }
    );
  }
}
