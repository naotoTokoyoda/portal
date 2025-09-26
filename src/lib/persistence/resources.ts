import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export type ResourceDepartmentScope = string[];

export type AuditActionType = 'create' | 'update' | 'delete' | 'version';
export type AuditResourceType = 'announcement' | 'document' | 'link';

export interface ActorDetails {
  id: string;
  email?: string | null;
  name?: string | null;
  department?: string | null;
}

export interface AuditRecord {
  id: string;
  actor: ActorDetails | null;
  resourceId: string;
  resourceType: AuditResourceType;
  action: AuditActionType;
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  category: string;
  departments: ResourceDepartmentScope;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionRecord {
  id: string;
  version: number;
  summary: string;
  fileName: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  category: string;
  departments: ResourceDepartmentScope;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  currentVersionId: string | null;
  versions: DocumentVersionRecord[];
}

export interface LinkRecord {
  id: string;
  title: string;
  url: string;
  description?: string;
  category: string;
  departments: ResourceDepartmentScope;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface StoreShape {
  announcements: AnnouncementRecord[];
  documents: DocumentRecord[];
  links: LinkRecord[];
  auditLog: AuditRecord[];
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  category: string;
  departments: ResourceDepartmentScope;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  category?: string;
  departments?: ResourceDepartmentScope;
}

export interface CreateDocumentInput {
  title: string;
  category: string;
  departments: ResourceDepartmentScope;
  initialVersion: {
    summary: string;
    fileName: string;
    content: string;
  };
}

export interface UpdateDocumentInput {
  title?: string;
  category?: string;
  departments?: ResourceDepartmentScope;
}

export interface AddDocumentVersionInput {
  summary: string;
  fileName: string;
  content: string;
}

export interface CreateLinkInput {
  title: string;
  url: string;
  description?: string;
  category: string;
  departments: ResourceDepartmentScope;
}

export interface UpdateLinkInput {
  title?: string;
  url?: string;
  description?: string;
  category?: string;
  departments?: ResourceDepartmentScope;
}

const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIRECTORY, 'resources.json');

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: StoreShape = {
      announcements: [],
      documents: [],
      links: [],
      auditLog: [],
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw) as Partial<StoreShape>;
  const announcements = Array.isArray(parsed.announcements)
    ? parsed.announcements
    : [];
  const documents = Array.isArray(parsed.documents) ? parsed.documents : [];
  const links = Array.isArray(parsed.links) ? parsed.links : [];
  const auditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog : [];

  return {
    announcements: announcements.map((record) => ({
      ...record,
      departments: Array.isArray(record.departments)
        ? [...record.departments]
        : [],
    })),
    documents: documents.map((record) => ({
      ...record,
      departments: Array.isArray(record.departments)
        ? [...record.departments]
        : [],
      versions: Array.isArray(record.versions)
        ? record.versions.map((version) => ({
            ...version,
          }))
        : [],
    })),
    links: links.map((record) => ({
      ...record,
      departments: Array.isArray(record.departments)
        ? [...record.departments]
        : [],
    })),
    auditLog: auditLog.map((entry) => ({
      ...entry,
    })),
  } satisfies StoreShape;
}

async function writeStore(store: StoreShape): Promise<void> {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function sortAuditLog(records: AuditRecord[]): AuditRecord[] {
  return [...records].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function createAuditRecord(options: {
  actor: ActorDetails | null;
  resourceId: string;
  resourceType: AuditResourceType;
  action: AuditActionType;
  summary: string;
  metadata?: Record<string, unknown>;
}): AuditRecord {
  return {
    id: randomUUID(),
    actor: options.actor,
    resourceId: options.resourceId,
    resourceType: options.resourceType,
    action: options.action,
    summary: options.summary,
    timestamp: new Date().toISOString(),
    metadata: options.metadata,
  };
}

export async function listAnnouncements(): Promise<AnnouncementRecord[]> {
  const store = await readStore();
  return sortByUpdatedAt(store.announcements);
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const store = await readStore();
  return sortByUpdatedAt(store.documents);
}

export async function listLinks(): Promise<LinkRecord[]> {
  const store = await readStore();
  return sortByUpdatedAt(store.links);
}

export async function listAuditRecords(): Promise<AuditRecord[]> {
  const store = await readStore();
  return sortAuditLog(store.auditLog);
}

export async function getAnnouncementById(
  id: string
): Promise<AnnouncementRecord | null> {
  const store = await readStore();
  return (
    store.announcements.find((announcement) => announcement.id === id) ?? null
  );
}

export async function getDocumentById(
  id: string
): Promise<DocumentRecord | null> {
  const store = await readStore();
  return store.documents.find((document) => document.id === id) ?? null;
}

export async function getLinkById(id: string): Promise<LinkRecord | null> {
  const store = await readStore();
  return store.links.find((link) => link.id === id) ?? null;
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  actor: ActorDetails
): Promise<AnnouncementRecord> {
  const now = new Date().toISOString();
  const record: AnnouncementRecord = {
    id: randomUUID(),
    title: input.title,
    body: input.body,
    category: input.category,
    departments: [...input.departments],
    authorId: actor.id,
    createdAt: now,
    updatedAt: now,
  };

  const store = await readStore();
  store.announcements.push(record);
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: record.id,
      resourceType: 'announcement',
      action: 'create',
      summary: `Created announcement “${record.title}”.`,
      metadata: { category: record.category, departments: record.departments },
    })
  );
  await writeStore(store);
  return record;
}

export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput,
  actor: ActorDetails
): Promise<AnnouncementRecord | null> {
  const store = await readStore();
  const existingIndex = store.announcements.findIndex(
    (announcement) => announcement.id === id
  );
  if (existingIndex < 0) {
    return null;
  }

  const existing = store.announcements[existingIndex];
  const updated: AnnouncementRecord = {
    ...existing,
    title: input.title ?? existing.title,
    body: input.body ?? existing.body,
    category: input.category ?? existing.category,
    departments: input.departments ?? existing.departments,
    updatedAt: new Date().toISOString(),
  };

  store.announcements[existingIndex] = updated;
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: updated.id,
      resourceType: 'announcement',
      action: 'update',
      summary: `Updated announcement “${updated.title}”.`,
      metadata: {
        category: updated.category,
        departments: updated.departments,
      },
    })
  );
  await writeStore(store);
  return updated;
}

export async function deleteAnnouncement(
  id: string,
  actor: ActorDetails
): Promise<boolean> {
  const store = await readStore();
  const existingIndex = store.announcements.findIndex(
    (announcement) => announcement.id === id
  );
  if (existingIndex < 0) {
    return false;
  }

  const [removed] = store.announcements.splice(existingIndex, 1);
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: removed.id,
      resourceType: 'announcement',
      action: 'delete',
      summary: `Deleted announcement “${removed.title}”.`,
      metadata: { category: removed.category },
    })
  );
  await writeStore(store);
  return true;
}

export async function createDocument(
  input: CreateDocumentInput,
  actor: ActorDetails
): Promise<DocumentRecord> {
  const now = new Date().toISOString();
  const versionId = randomUUID();
  const version: DocumentVersionRecord = {
    id: versionId,
    version: 1,
    summary: input.initialVersion.summary,
    fileName: input.initialVersion.fileName,
    content: input.initialVersion.content,
    createdAt: now,
    createdBy: actor.id,
  };

  const record: DocumentRecord = {
    id: randomUUID(),
    title: input.title,
    category: input.category,
    departments: [...input.departments],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    currentVersionId: versionId,
    versions: [version],
  };

  const store = await readStore();
  store.documents.push(record);
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: record.id,
      resourceType: 'document',
      action: 'create',
      summary: `Created document “${record.title}”.`,
      metadata: {
        category: record.category,
        departments: record.departments,
        version: version.version,
      },
    })
  );
  await writeStore(store);
  return record;
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
  actor: ActorDetails
): Promise<DocumentRecord | null> {
  const store = await readStore();
  const index = store.documents.findIndex((document) => document.id === id);
  if (index < 0) {
    return null;
  }

  const existing = store.documents[index];
  const updated: DocumentRecord = {
    ...existing,
    title: input.title ?? existing.title,
    category: input.category ?? existing.category,
    departments: input.departments ?? existing.departments,
    updatedAt: new Date().toISOString(),
  };

  store.documents[index] = updated;
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: updated.id,
      resourceType: 'document',
      action: 'update',
      summary: `Updated document “${updated.title}”.`,
      metadata: {
        category: updated.category,
        departments: updated.departments,
      },
    })
  );
  await writeStore(store);
  return updated;
}

export async function deleteDocument(
  id: string,
  actor: ActorDetails
): Promise<boolean> {
  const store = await readStore();
  const index = store.documents.findIndex((document) => document.id === id);
  if (index < 0) {
    return false;
  }

  const [removed] = store.documents.splice(index, 1);
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: removed.id,
      resourceType: 'document',
      action: 'delete',
      summary: `Deleted document “${removed.title}”.`,
      metadata: { category: removed.category },
    })
  );
  await writeStore(store);
  return true;
}

export async function addDocumentVersion(
  id: string,
  input: AddDocumentVersionInput,
  actor: ActorDetails
): Promise<DocumentRecord | null> {
  const store = await readStore();
  const index = store.documents.findIndex((document) => document.id === id);
  if (index < 0) {
    return null;
  }

  const existing = store.documents[index];
  const latestVersion = existing.versions.reduce((max, current) => {
    return current.version > max ? current.version : max;
  }, 0);

  const newVersionNumber = latestVersion + 1;
  const versionId = randomUUID();
  const now = new Date().toISOString();
  const version: DocumentVersionRecord = {
    id: versionId,
    version: newVersionNumber,
    summary: input.summary,
    fileName: input.fileName,
    content: input.content,
    createdAt: now,
    createdBy: actor.id,
  };

  const updated: DocumentRecord = {
    ...existing,
    updatedAt: now,
    currentVersionId: versionId,
    versions: [...existing.versions, version],
  };

  store.documents[index] = updated;
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: updated.id,
      resourceType: 'document',
      action: 'version',
      summary: `Added v${version.version} to document “${updated.title}”.`,
      metadata: { version: version.version, fileName: version.fileName },
    })
  );
  await writeStore(store);
  return updated;
}

export async function createLink(
  input: CreateLinkInput,
  actor: ActorDetails
): Promise<LinkRecord> {
  const now = new Date().toISOString();
  const record: LinkRecord = {
    id: randomUUID(),
    title: input.title,
    url: input.url,
    description: input.description,
    category: input.category,
    departments: [...input.departments],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
  };

  const store = await readStore();
  store.links.push(record);
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: record.id,
      resourceType: 'link',
      action: 'create',
      summary: `Created link “${record.title}”.`,
      metadata: { category: record.category, url: record.url },
    })
  );
  await writeStore(store);
  return record;
}

export async function updateLink(
  id: string,
  input: UpdateLinkInput,
  actor: ActorDetails
): Promise<LinkRecord | null> {
  const store = await readStore();
  const index = store.links.findIndex((link) => link.id === id);
  if (index < 0) {
    return null;
  }

  const existing = store.links[index];
  const updated: LinkRecord = {
    ...existing,
    title: input.title ?? existing.title,
    url: input.url ?? existing.url,
    description: input.description ?? existing.description,
    category: input.category ?? existing.category,
    departments: input.departments ?? existing.departments,
    updatedAt: new Date().toISOString(),
  };

  store.links[index] = updated;
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: updated.id,
      resourceType: 'link',
      action: 'update',
      summary: `Updated link “${updated.title}”.`,
      metadata: { category: updated.category, url: updated.url },
    })
  );
  await writeStore(store);
  return updated;
}

export async function deleteLink(
  id: string,
  actor: ActorDetails
): Promise<boolean> {
  const store = await readStore();
  const index = store.links.findIndex((link) => link.id === id);
  if (index < 0) {
    return false;
  }

  const [removed] = store.links.splice(index, 1);
  store.auditLog.push(
    createAuditRecord({
      actor,
      resourceId: removed.id,
      resourceType: 'link',
      action: 'delete',
      summary: `Deleted link “${removed.title}”.`,
      metadata: { category: removed.category },
    })
  );
  await writeStore(store);
  return true;
}

export async function clearResourcesStore(): Promise<void> {
  const initial: StoreShape = {
    announcements: [],
    documents: [],
    links: [],
    auditLog: [],
  };
  await writeStore(initial);
}
