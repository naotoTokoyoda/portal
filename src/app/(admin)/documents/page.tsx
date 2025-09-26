import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminActor, requireAdminSession } from '@/lib/auth/admin';
import { formatDepartments, parseDepartmentInput } from '@/lib/access-control';
import {
  appendDocumentVersion,
  createVersionedDocument,
  getLatestDocumentVersion,
  getOrderedVersions,
  listDocuments,
  updateDocumentMetadata,
  deleteDocument,
} from '@/lib/documents';

const PAGE_PATH = '/documents';

async function createDocumentAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const category = (formData.get('category') as string | null)?.trim() ?? '';
  const departmentsInput = (formData.get('departments') as string | null) ?? '';
  const summary = (formData.get('summary') as string | null)?.trim() ?? '';
  const fileName = (formData.get('fileName') as string | null)?.trim() ?? '';
  const content = (formData.get('content') as string | null)?.trim() ?? '';

  if (!title || !summary || !fileName || !content) {
    redirect(PAGE_PATH + '?error=missing');
  }

  await createVersionedDocument(
    {
      title,
      category: category || 'general',
      departments: parseDepartmentInput(departmentsInput),
      initialVersion: {
        summary,
        fileName,
        content,
      },
    },
    actor
  );

  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=created');
}

async function updateDocumentAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) {
    redirect(PAGE_PATH + '?error=missing');
  }
  const title = (formData.get('title') as string | null)?.trim();
  const category = (formData.get('category') as string | null)?.trim();
  const departmentsInput = (formData.get('departments') as string | null) ?? '';

  await updateDocumentMetadata(
    id,
    {
      title: title ?? undefined,
      category: category ?? undefined,
      departments: parseDepartmentInput(departmentsInput),
    },
    actor
  );
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=updated');
}

async function addVersionAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) {
    redirect(PAGE_PATH + '?error=missing');
  }
  const summary = (formData.get('summary') as string | null)?.trim() ?? '';
  const fileName = (formData.get('fileName') as string | null)?.trim() ?? '';
  const content = (formData.get('content') as string | null)?.trim() ?? '';
  if (!summary || !fileName || !content) {
    redirect(PAGE_PATH + '?error=missing');
  }

  await appendDocumentVersion(
    id,
    {
      summary,
      fileName,
      content,
    },
    actor
  );
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=version-added');
}

async function deleteDocumentAction(formData: FormData) {
  'use server';
  const actor = await getAdminActor();
  const id = (formData.get('id') as string | null)?.trim();
  if (!id) {
    redirect(PAGE_PATH + '?error=missing');
  }
  await deleteDocument(id, actor);
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH + '?status=deleted');
}

export default async function DocumentsAdminPage() {
  const session = await requireAdminSession();
  const documents = await listDocuments();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {session.user?.email ?? 'admin'}
          </p>
          <h1 className="text-3xl font-semibold">Documents</h1>
          <p className="text-muted-foreground">
            Manage versioned documents and control departmental access.
          </p>
        </header>

        <section className="bg-card rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">Create Document</h2>
          <form action={createDocumentAction} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Title</span>
                <input
                  name="title"
                  required
                  className="border rounded-md px-3 py-2"
                  placeholder="Policy Manual"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Category</span>
                <input
                  name="category"
                  className="border rounded-md px-3 py-2"
                  placeholder="compliance"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Departments</span>
              <input
                name="departments"
                className="border rounded-md px-3 py-2"
                placeholder="operations, finance"
              />
              <span className="text-xs text-muted-foreground">
                Leave blank to share with everyone. Separate departments with
                commas.
              </span>
            </label>
            <div className="grid md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-medium">Version summary</span>
                <input
                  name="summary"
                  required
                  className="border rounded-md px-3 py-2"
                  placeholder="Initial release"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">File name</span>
                <input
                  name="fileName"
                  required
                  className="border rounded-md px-3 py-2"
                  placeholder="policy-v1.txt"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Content</span>
              <textarea
                name="content"
                required
                className="border rounded-md px-3 py-2 min-h-[140px]"
                placeholder="Paste the document contents"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Save document
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Existing documents</h2>
          <div className="space-y-6">
            {documents.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No documents uploaded yet.
              </p>
            )}
            {documents.map((document) => {
              const latest = getLatestDocumentVersion(document);
              const versions = getOrderedVersions(document);
              const nextVersionNumber = (versions[0]?.version ?? 0) + 1;
              return (
                <article
                  key={document.id}
                  className="border rounded-lg p-6 space-y-5 bg-card"
                >
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{document.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Category: {document.category || 'general'} · Visible to:{' '}
                      {formatDepartments(document.departments)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(document.updatedAt).toLocaleString()}
                    </p>
                    {latest && (
                      <div className="text-sm text-muted-foreground">
                        Latest version: v{latest.version} ({latest.fileName}) ·{' '}
                        <a
                          href={`/api/documents/${document.id}/download`}
                          className="text-primary hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>

                  <form action={updateDocumentAction} className="space-y-3">
                    <input type="hidden" name="id" value={document.id} />
                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Title</span>
                        <input
                          name="title"
                          defaultValue={document.title}
                          className="border rounded-md px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Category</span>
                        <input
                          name="category"
                          defaultValue={document.category}
                          className="border rounded-md px-3 py-2"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Departments</span>
                      <input
                        name="departments"
                        defaultValue={document.departments.join(', ')}
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
                        formAction={deleteDocumentAction}
                        formMethod="post"
                        className="inline-flex items-center justify-center rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                    </div>
                  </form>

                  <div className="border rounded-md p-4 space-y-4 bg-background">
                    <h4 className="font-medium">Add new version</h4>
                    <form action={addVersionAction} className="space-y-3">
                      <input type="hidden" name="id" value={document.id} />
                      <div className="grid md:grid-cols-3 gap-4">
                        <label className="flex flex-col gap-2 md:col-span-2">
                          <span className="text-sm font-medium">Summary</span>
                          <input
                            name="summary"
                            className="border rounded-md px-3 py-2"
                            placeholder="Revision details"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium">File name</span>
                          <input
                            name="fileName"
                            className="border rounded-md px-3 py-2"
                            placeholder={`${document.title}-v${nextVersionNumber}.txt`}
                            required
                          />
                        </label>
                      </div>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Content</span>
                        <textarea
                          name="content"
                          className="border rounded-md px-3 py-2 min-h-[120px]"
                          placeholder="Paste new version contents"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                      >
                        Add version
                      </button>
                    </form>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Version history</h4>
                    <ul className="space-y-2 text-sm">
                      {versions.map((version) => (
                        <li
                          key={version.id}
                          className="border rounded-md px-3 py-2 flex flex-col gap-1"
                        >
                          <span className="font-medium">
                            v{version.version} · {version.summary}
                          </span>
                          <span className="text-muted-foreground">
                            {version.fileName} · Updated{' '}
                            {new Date(version.createdAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
