import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/options';
import { listActions, listUsers } from '@/lib/persistence/users';
import { UsersClient } from '@/app/(admin)/users/users-client';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/');
  }

  const adminId = session.user.id ?? '';
  const adminEmail = session.user.email ?? '';

  if (!adminId) {
    redirect('/');
  }

  const [users, actions] = await Promise.all([listUsers(), listActions()]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">{adminEmail}</p>
          <h1 className="text-3xl font-semibold">User Administration</h1>
          <p className="text-muted-foreground">
            Manage local accounts, set access credentials, toggle roles, and
            review a full audit log of recent actions.
          </p>
        </header>
        <UsersClient
          initialUsers={users}
          initialActions={actions}
          currentAdminId={adminId}
        />
      </div>
    </div>
  );
}
