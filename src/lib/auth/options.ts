import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {
  authenticateUserWithPassword,
  getUserById,
  type UserRecord,
} from '@/lib/persistence/users';

type MutableToken = {
  [key: string]: unknown;
  userId?: string;
  email?: string;
  role?: string;
  department?: string;
};

type AuthUser = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
};

function toAuthUser(record: UserRecord) {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    department: record.department,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'you@example.com',
        },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Record<string, unknown> | undefined) {
        const email =
          typeof credentials?.email === 'string' ? credentials.email : null;
        const password =
          typeof credentials?.password === 'string'
            ? credentials.password
            : null;
        if (!email) {
          throw new Error('Email is required.');
        }
        if (!password) {
          throw new Error('Password is required.');
        }

        console.log('Attempting authentication for:', email);
        const record = await authenticateUserWithPassword(email, password);
        console.log('Authentication result:', record ? 'SUCCESS' : 'FAILED');
        if (!record) {
          return null;
        }

        return toAuthUser(record);
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      const authToken = token as MutableToken;

      if (user) {
        const authUser = user as AuthUser;
        authToken.userId =
          typeof authUser.id === 'string' ? authUser.id : undefined;
        authToken.email =
          typeof authUser.email === 'string' ? authUser.email : undefined;
        authToken.role =
          authUser.role === 'admin' || authUser.role === 'user'
            ? authUser.role
            : undefined;
        authToken.department =
          typeof authUser.department === 'string'
            ? authUser.department
            : undefined;
        return authToken;
      }

      const userId =
        typeof authToken.userId === 'string' ? authToken.userId : null;
      if (userId) {
        const latest = await getUserById(userId);
        if (latest) {
          authToken.email = latest.email;
          authToken.role = latest.role;
          authToken.department = latest.department;
        } else {
          delete authToken.userId;
          delete authToken.role;
          delete authToken.department;
          delete authToken.email;
        }
      }

      return authToken;
    },
    async session({ session, token }) {
      const authSession = session as {
        user?: {
          id?: string;
          email?: string | null;
          role?: string;
          department?: string;
        };
      };
      const authToken = token as MutableToken;

      if (authSession.user) {
        const tokenUserId =
          typeof authToken.userId === 'string' ? authToken.userId : undefined;
        if (tokenUserId) {
          authSession.user.id = tokenUserId;
        }
        if (typeof authToken.email === 'string') {
          authSession.user.email = authToken.email;
        }
        if (typeof authToken.role === 'string') {
          authSession.user.role = authToken.role as 'admin' | 'user';
        }
        if (typeof authToken.department === 'string') {
          authSession.user.department = authToken.department;
        }
      }

      return authSession;
    },
  },
};
