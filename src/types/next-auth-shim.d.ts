declare module 'next-auth' {
  export interface SessionUser {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    department?: string | null;
  }

  export interface Session {
    user?: SessionUser | null;
  }

  export interface NextAuthCallbacks {
    jwt?: (params: {
      token: unknown;
      account?: unknown;
      profile?: unknown;
      user?: unknown;
    }) => Promise<unknown> | unknown;
    session?: (params: {
      session: unknown;
      token: unknown;
    }) => Promise<unknown> | unknown;
    signIn?: (params: {
      account?: unknown;
      profile?: unknown;
      user: unknown;
    }) => Promise<boolean> | boolean;
  }

  export interface NextAuthOptions {
    providers: Array<Record<string, unknown>>;
    session?: { strategy?: string };
    callbacks?: NextAuthCallbacks;
  }

  const NextAuth: (
    options: NextAuthOptions
  ) => (req: unknown, res: unknown) => Promise<unknown>;
  export default NextAuth;

  export const getServerSession: (
    ...args: unknown[]
  ) => Promise<Session | null>;
}

declare module 'next-auth/react' {
  import type { Session } from 'next-auth';
  import type { ComponentType, ReactNode } from 'react';

  export const SessionProvider: ComponentType<{
    children: ReactNode;
    session?: Session | null;
  }>;
  export function signIn(
    provider?: string,
    options?: Record<string, unknown>
  ): Promise<void>;
  export function signOut(options?: Record<string, unknown>): Promise<void>;
  export function useSession(): {
    data: Session | null;
    status: 'loading' | 'authenticated' | 'unauthenticated';
  };
}

declare module 'next-auth/providers/google' {
  const GoogleProvider: (
    options: Record<string, unknown>
  ) => Record<string, unknown>;
  export default GoogleProvider;
}

declare module 'next-auth/providers/azure-ad' {
  const AzureADProvider: (
    options: Record<string, unknown>
  ) => Record<string, unknown>;
  export default AzureADProvider;
}
