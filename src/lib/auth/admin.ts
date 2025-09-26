import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ActorDetails } from '@/lib/persistence/resources';
import { authOptions } from '@/lib/auth/options';

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/');
  }
  if (!session.user.id) {
    redirect('/');
  }
  return session;
}

export async function getAdminActor(): Promise<ActorDetails> {
  const session = await requireAdminSession();
  return {
    id: session.user?.id ?? '',
    email: session.user?.email,
    name: session.user?.name,
    department: session.user?.department,
  };
}
