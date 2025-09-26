import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminActor, requireAdminSession } from '@/lib/auth/admin';
import { formatDepartments, parseDepartmentInput } from '@/lib/access-control';
import {
  createLink,
  deleteLink,
  listLinks,
  updateLink,
} from '@/lib/persistence/resources';

const PAGE_PATH = '/links';

async function createLinkAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const url = (formData.get('url') as string | null)?.trim() ?? '';
  const category = (formData.get('category') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim();
  const departmentsInput = (formData.get('departments') as string | null) ?? '';

  if (!title || !url) {
    redirect(PAGE_PATH + '?error=missing');
  }

  await createLink(
    {
      title,
      url,
      description: description || undefined,
      category: category || 'general',
      departments: parseDepartmentInput(departmentsInput),
    },
    actor
  );
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=created');
}

async function updateLinkAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) {
    redirect(PAGE_PATH + '?error=missing');
  }
  const title = (formData.get('title') as string | null)?.trim();
  const url = (formData.get('url') as string | null)?.trim();
  const category = (formData.get('category') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim();
  const departmentsInput = (formData.get('departments') as string | null) ?? '';

  await updateLink(
    id,
    {
      title: title ?? undefined,
      url: url ?? undefined,
      category: category ?? undefined,
      description: description ?? undefined,
      departments: parseDepartmentInput(departmentsInput),
    },
    actor
  );
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=updated');
}

async function deleteLinkAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) {
    redirect(PAGE_PATH + '?error=missing');
  }
  await deleteLink(id, actor);
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=deleted');
}

export default async function LinksAdminPage() {
  const session = await requireAdminSession();
  const links = await listLinks();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {session.user?.email ?? 'admin'}
          </p>
          <h1 className="text-3xl font-semibold">Links</h1>
          <p className="text-muted-foreground">
            Curate quick access links with departmental access controls.
          </p>
        </header>

        <section className="bg-card rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">Create Link</h2>
          <form action={createLinkAction} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Title</span>
                <input
                  name="title"
                  required
                  className="border rounded-md px-3 py-2"
                  placeholder="Intranet"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">URL</span>
                <input
                  name="url"
                  required
                  className="border rounded-md px-3 py-2"
                  placeholder="https://example.com"
                />
              </label>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Category</span>
                <input
                  name="category"
                  className="border rounded-md px-3 py-2"
                  placeholder="resources"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Departments</span>
                <input
                  name="departments"
                  className="border rounded-md px-3 py-2"
                  placeholder="it, hr"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Description</span>
              <textarea
                name="description"
                className="border rounded-md px-3 py-2 min-h-[100px]"
                placeholder="Short summary for portal users"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Save link
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Existing links</h2>
          <div className="space-y-6">
            {links.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No links created yet.
              </p>
            )}
            {links.map((link) => (
              <article
                key={link.id}
                className="border rounded-lg p-6 space-y-4 bg-card"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{link.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Category: {link.category || 'general'} · Visible to:{' '}
                    {formatDepartments(link.departments)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(link.updatedAt).toLocaleString()}
                  </p>
                </div>
                <form action={updateLinkAction} className="space-y-3">
                  <input type="hidden" name="id" value={link.id} />
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Title</span>
                      <input
                        name="title"
                        defaultValue={link.title}
                        className="border rounded-md px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">URL</span>
                      <input
                        name="url"
                        defaultValue={link.url}
                        className="border rounded-md px-3 py-2"
                      />
                    </label>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Category</span>
                      <input
                        name="category"
                        defaultValue={link.category}
                        className="border rounded-md px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Departments</span>
                      <input
                        name="departments"
                        defaultValue={link.departments.join(', ')}
                        className="border rounded-md px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Description</span>
                    <textarea
                      name="description"
                      defaultValue={link.description}
                      className="border rounded-md px-3 py-2 min-h-[100px]"
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
                      formAction={deleteLinkAction}
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
