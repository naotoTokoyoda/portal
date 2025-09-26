import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth/options';
import { formatDepartments, hasDepartmentAccess } from '@/lib/access-control';
import { getAnnouncementById } from '@/lib/persistence/resources';

type Params = {
  params: { id: string };
};

export default async function AnnouncementDetailPage({ params }: Params) {
  const announcement = await getAnnouncementById(params.id);
  if (!announcement) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'admin';
  const hasAccess = hasDepartmentAccess(
    session?.user?.department,
    announcement.departments,
    {
      allowAllForAdmins: true,
      isAdmin,
    }
  );

  if (!hasAccess) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Announcement · {announcement.category || 'general'}
          </p>
          <h1 className="text-3xl font-semibold">{announcement.title}</h1>
          <p className="text-sm text-muted-foreground">
            Updated {new Date(announcement.updatedAt).toLocaleString()} ·
            Visible to {formatDepartments(announcement.departments)}
          </p>
        </div>
        <article className="text-base leading-relaxed whitespace-pre-line">
          {announcement.body}
        </article>
      </div>
    </div>
  );
}
