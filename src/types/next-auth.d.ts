import NextAuth from 'next-auth';
import type { UserRole } from '@/lib/persistence/users';

declare module 'next-auth' {
  interface Session {
    user?: NextAuth.User & {
      id: string;
      role: UserRole;
      department?: string;
    };
  }

  interface User {
    role: UserRole;
    department?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: UserRole;
    department?: string;
  }
}
