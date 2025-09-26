import Link from 'next/link';
import { requireAdminSession } from '@/lib/auth/admin';
import {
  listAnnouncements,
  listAuditRecords,
  listLinks,
} from '@/lib/persistence/resources';
import { listDocuments } from '@/lib/documents';
import { listActions, listUsers } from '@/lib/persistence/users';

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const [announcements, documents, links, auditLog, users, userActions] =
    await Promise.all([
      listAnnouncements(),
      listDocuments(),
      listLinks(),
      listAuditRecords(),
      listUsers(),
      listActions(),
    ]);

  const totalAdmins = users.filter((user) => user.role === 'admin').length;
  const recentAudit = auditLog.slice(0, 10);
  const recentUserActions = userActions.slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {session.user?.email ?? 'admin'}
          </p>
          <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Unified management for users, announcements, documents, and links
            with a consolidated audit trail.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="Users"
            value={`${users.length}`}
            description={`${totalAdmins} admins`}
            href="/users"
          />
          <DashboardCard
            title="Announcements"
            value={`${announcements.length}`}
            description="Manage communication"
            href="/announcements"
          />
          <DashboardCard
            title="Documents"
            value={`${documents.length}`}
            description="Versioned files"
            href="/documents"
          />
          <DashboardCard
            title="Links"
            value={`${links.length}`}
            description="Curated resources"
            href="/links"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="border rounded-lg p-6 bg-card space-y-3">
            <h2 className="text-xl font-semibold">Recent resource activity</h2>
            <p className="text-sm text-muted-foreground">
              Track document versions, announcement updates, and link changes.
            </p>
            <ul className="space-y-3 text-sm">
              {recentAudit.length === 0 && (
                <li className="text-muted-foreground">
                  No resource activity yet.
                </li>
              )}
              {recentAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="border rounded-md px-3 py-2 bg-background"
                >
                  <p className="font-medium">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.resourceType.toUpperCase()} ·{' '}
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="border rounded-lg p-6 bg-card space-y-3">
            <h2 className="text-xl font-semibold">Recent user actions</h2>
            <p className="text-sm text-muted-foreground">
              Review authentication events and administrative updates.
            </p>
            <ul className="space-y-3 text-sm">
              {recentUserActions.length === 0 && (
                <li className="text-muted-foreground">No user activity yet.</li>
              )}
              {recentUserActions.map((action) => (
                <li
                  key={action.id}
                  className="border rounded-md px-3 py-2 bg-background"
                >
                  <p className="font-medium">{action.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {action.type.toUpperCase()} ·{' '}
                    {new Date(action.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border rounded-lg p-6 bg-card space-y-4">
          <h2 className="text-xl font-semibold">Quick actions</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              href="/announcements"
              title="Post announcement"
              description="Share news with selected departments."
            />
            <QuickAction
              href="/documents"
              title="Upload document"
              description="Add a new version-controlled file."
            />
            <QuickAction
              href="/links"
              title="Curate link"
              description="Add shortcuts for teams."
            />
            <QuickAction
              href="/users"
              title="Manage users"
              description="Adjust roles and credentials."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

type DashboardCardProps = {
  title: string;
  value: string;
  description: string;
  href: string;
};

function DashboardCard({
  title,
  value,
  description,
  href,
}: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="border rounded-lg p-6 bg-card hover:border-primary transition-colors"
    >
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

type QuickActionProps = {
  href: string;
  title: string;
  description: string;
};

function QuickAction({ href, title, description }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="border rounded-lg p-4 bg-background hover:border-primary transition-colors"
    >
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
