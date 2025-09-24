import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { normalizeIdentityProfile } from '@/lib/auth/identity';
import {
  resolveDepartmentFromIdentity,
  resolveRoleFromDepartment,
} from '@/lib/auth/config';
import {
  getUserByEmail,
  upsertUserFromIdentity,
} from '@/lib/persistence/users';

type MutableToken = {
  [key: string]: unknown;
  email?: string;
  userId?: string;
  role?: string;
  department?: string;
};

type AuthUser = {
  email?: string | null;
  name?: string | null;
  persistedUserId?: string;
  role?: string;
  department?: string;
};

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'select_account',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  );
} else {
  console.warn('Google Workspace provider is not configured.');
}

if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      authorization: {
        params: {
          scope: 'openid profile email offline_access User.Read',
        },
      },
    })
  );
} else {
  console.warn('Microsoft 365 provider is not configured.');
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      const authToken = token as MutableToken;
      const authAccount = (account ?? undefined) as
        | { provider?: string }
        | undefined;
      const authProfile = profile as Record<string, unknown> | undefined;
      const authUser = (user ?? undefined) as AuthUser | undefined;

      if (authAccount?.provider) {
        try {
          const normalized = normalizeIdentityProfile(
            authAccount.provider,
            authProfile,
            authUser
          );
          const persistedUserId = authUser?.persistedUserId;
          if (persistedUserId) {
            authToken.userId = persistedUserId;
            authToken.role =
              (authUser?.role as MutableToken['role']) ?? authToken.role;
            authToken.department =
              (authUser?.department as MutableToken['department']) ??
              authToken.department;
            authToken.email = normalized.email;
            return authToken;
          }
          const department = resolveDepartmentFromIdentity(
            normalized.email,
            normalized.department
          );
          const role = resolveRoleFromDepartment(department, normalized.groups);
          const record =
            (await getUserByEmail(normalized.email)) ??
            (await upsertUserFromIdentity({
              email: normalized.email,
              name: normalized.name,
              department,
              role,
              provider: authAccount.provider,
              metadata: normalized.raw ?? undefined,
            }));
          authToken.userId = record.id;
          authToken.role = record.role;
          authToken.department = record.department;
          authToken.email = record.email;
          return authToken;
        } catch (error) {
          console.error('Failed to synchronise identity profile', error);
          throw error;
        }
      }

      const emailCandidate =
        (typeof authUser?.email === 'string' && authUser.email) ||
        (typeof authToken.email === 'string' && authToken.email) ||
        null;

      if (emailCandidate) {
        const persisted = await getUserByEmail(emailCandidate);
        if (persisted) {
          authToken.userId = persisted.id;
          authToken.role = persisted.role;
          authToken.department = persisted.department;
          authToken.email = persisted.email;
        }
      }

      return authToken;
    },
    async session({ session, token }) {
      const authSession = session as {
        user?: { id?: string; role?: string; department?: string };
      };
      const authToken = token as MutableToken;

      if (authSession.user) {
        const tokenUserId =
          typeof authToken.userId === 'string' ? authToken.userId : '';
        authSession.user.id = tokenUserId;
        const nextRole =
          authToken.role === 'admin'
            ? 'admin'
            : authToken.role === 'user'
              ? 'user'
              : 'user';
        authSession.user.role = nextRole;
        if (typeof authToken.department === 'string') {
          authSession.user.department = authToken.department;
        }
      }
      return authSession;
    },
    async signIn({ account, profile, user }) {
      const authAccount = (account ?? undefined) as
        | { provider?: string }
        | undefined;
      const authProfile = profile as Record<string, unknown> | undefined;
      const authUser = (user ?? undefined) as AuthUser | undefined;

      if (!authUser?.email) {
        return false;
      }

      if (authAccount?.provider) {
        try {
          const normalized = normalizeIdentityProfile(
            authAccount.provider,
            authProfile,
            authUser
          );
          const department = resolveDepartmentFromIdentity(
            normalized.email,
            normalized.department
          );
          const role = resolveRoleFromDepartment(department, normalized.groups);
          const record = await upsertUserFromIdentity({
            email: normalized.email,
            name: normalized.name,
            department,
            role,
            provider: authAccount.provider,
            metadata: normalized.raw ?? undefined,
          });
          if (authUser) {
            authUser.persistedUserId = record.id;
            authUser.role = record.role;
            authUser.department = record.department;
          }
        } catch (error) {
          console.error('Failed to persist user from provider', error);
          return false;
        }
      }

      return true;
    },
  },
};
