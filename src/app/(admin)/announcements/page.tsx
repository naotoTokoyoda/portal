import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminActor, requireAdminSession } from '@/lib/auth/admin';
import { formatDepartments, parseDepartmentInput } from '@/lib/access-control';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from '@/lib/persistence/resources';

const PAGE_PATH = '/announcements';

async function createAnnouncementAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const body = (formData.get('body') as string | null)?.trim() ?? '';
  const category = (formData.get('category') as string | null)?.trim() ?? '';
  const departmentsInput = (formData.get('departments') as string | null) ?? '';
  if (!title || !body) {
    redirect(PAGE_PATH + '?error=missing');
  }

  await createAnnouncement(
    {
      title,
      body,
      category: category || 'general',
      departments: parseDepartmentInput(departmentsInput),
    },
    actor
  );
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=created');
}

async function updateAnnouncementAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) {
    redirect(PAGE_PATH + '?error=missing');
  }
  const title = (formData.get('title') as string | null)?.trim();
  const body = (formData.get('body') as string | null)?.trim();
  const category = (formData.get('category') as string | null)?.trim();
  const departmentsInput = (formData.get('departments') as string | null) ?? '';

  await updateAnnouncement(
    id,
    {
      title: title ?? undefined,
      body: body ?? undefined,
      category: category ?? undefined,
      departments: parseDepartmentInput(departmentsInput),
    },
    actor
  );

  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=updated');
}

async function deleteAnnouncementAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) {
    redirect(PAGE_PATH + '?error=missing');
  }
  await deleteAnnouncement(id, actor);
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=deleted');
}

export default async function AnnouncementsAdminPage() {
  const session = await requireAdminSession();
  const announcements = await listAnnouncements();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {session.user?.email ?? 'admin'}
          </p>
          <h1 className="text-3xl font-semibold">Announcements</h1>
          <p className="text-muted-foreground">
            Publish news to the portal and control visibility by department.
          </p>
        </header>

        <section className="bg-card rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">Create Announcement</h2>
          <form action={createAnnouncementAction} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Title</span>
                <input
                  name="title"
                  required
                  className="border rounded-md px-3 py-2"
                  placeholder="Quarterly update"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Category</span>
                <input
                  name="category"
                  className="border rounded-md px-3 py-2"
                  placeholder="general"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Body</span>
              <textarea
                name="body"
                required
                className="border rounded-md px-3 py-2 min-h-[120px]"
                placeholder="Add the announcement details"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Departments</span>
              <input
                name="departments"
                className="border rounded-md px-3 py-2"
                placeholder="finance, hr"
              />
              <span className="text-xs text-muted-foreground">
                Leave blank to share with everyone. Separate multiple
                departments with commas.
              </span>
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Publish announcement
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Existing announcements</h2>
          <div className="space-y-6">
            {announcements.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No announcements created yet.
              </p>
            )}
            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="border rounded-lg p-6 space-y-4 bg-card"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">
                    {announcement.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Category: {announcement.category || 'general'} · Visible to:{' '}
                    {formatDepartments(announcement.departments)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(announcement.updatedAt).toLocaleString()}
                  </p>
                </div>
                <form action={updateAnnouncementAction} className="space-y-3">
                  <input type="hidden" name="id" value={announcement.id} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Title</span>
                      <input
                        name="title"
                        defaultValue={announcement.title}
                        className="border rounded-md px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Category</span>
                      <input
                        name="category"
                        defaultValue={announcement.category}
                        className="border rounded-md px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Body</span>
                    <textarea
                      name="body"
                      defaultValue={announcement.body}
                      className="border rounded-md px-3 py-2 min-h-[120px]"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Departments</span>
                    <input
                      name="departments"
                      defaultValue={announcement.departments.join(', ')}
                      className="border rounded-md px-3 py-2"
                    />
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Save changes
                    </button>
                    <button
                      formAction={deleteAnnouncementAction}
                      formMethod="post"
                      className="inline-flex items-center justify-center rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
