import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth/options';
import { formatDepartments, hasDepartmentAccess } from '@/lib/access-control';
import {
  getDocumentById,
  getLatestDocumentVersion,
  getOrderedVersions,
} from '@/lib/documents';

type Params = {
  params: { id: string };
};

export default async function DocumentDetailPage({ params }: Params) {
  const document = await getDocumentById(params.id);
  if (!document) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'admin';
  const hasAccess = hasDepartmentAccess(
    session?.user?.department,
    document.departments,
    {
      allowAllForAdmins: true,
      isAdmin,
    }
  );

  if (!hasAccess) {
    notFound();
  }

  const latest = getLatestDocumentVersion(document);
  const versions = getOrderedVersions(document);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Document · {document.category || 'general'}
          </p>
          <h1 className="text-3xl font-semibold">{document.title}</h1>
          <p className="text-sm text-muted-foreground">
            Updated {new Date(document.updatedAt).toLocaleString()} · Visible to{' '}
            {formatDepartments(document.departments)}
          </p>
        </div>

        {latest ? (
          <div className="border rounded-lg p-6 bg-card space-y-3">
            <h2 className="text-xl font-semibold">Latest version</h2>
            <p className="text-sm text-muted-foreground">
              v{latest.version} · {latest.summary}
            </p>
            <a
              href={`/api/documents/${document.id}/download`}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Download {latest.fileName}
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This document has no available versions yet.
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Version history</h2>
          <ul className="space-y-2 text-sm">
            {versions.map((version) => (
              <li
                key={version.id}
                className="border rounded-md px-3 py-2 bg-card"
              >
                <p className="font-medium">
                  v{version.version} · {version.summary}
                </p>
                <p className="text-xs text-muted-foreground">
                  {version.fileName} · Published{' '}
                  {new Date(version.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
