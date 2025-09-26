import { filterByDepartment } from '@/lib/access-control';
import {
  listAnnouncements,
  listDocuments,
  listLinks,
  type AnnouncementRecord,
  type DocumentRecord,
  type LinkRecord,
} from '@/lib/persistence/resources';

export type SearchResourceType = 'announcement' | 'document' | 'link';

export interface SearchIndexEntry {
  id: string;
  type: SearchResourceType;
  title: string;
  description: string;
  category: string;
  departments: string[];
  updatedAt: string;
  link: string;
}

export interface SearchResult extends SearchIndexEntry {
  highlightedTitle: string;
  highlightedDescription: string;
}

function toAnnouncementEntry(record: AnnouncementRecord): SearchIndexEntry {
  return {
    id: record.id,
    type: 'announcement',
    title: record.title,
    description: record.body,
    category: record.category,
    departments: record.departments,
    updatedAt: record.updatedAt,
    link: `/announcements/${record.id}`,
  };
}

function toDocumentEntry(record: DocumentRecord): SearchIndexEntry {
  const latest = record.versions.find(
    (version) => version.id === record.currentVersionId
  );
  const summary = latest?.summary ?? 'Document available';
  return {
    id: record.id,
    type: 'document',
    title: record.title,
    description: summary,
    category: record.category,
    departments: record.departments,
    updatedAt: record.updatedAt,
    link: `/documents/${record.id}`,
  };
}

function toLinkEntry(record: LinkRecord): SearchIndexEntry {
  return {
    id: record.id,
    type: 'link',
    title: record.title,
    description: record.description ?? record.url,
    category: record.category,
    departments: record.departments,
    updatedAt: record.updatedAt,
    link: record.url,
  };
}

export async function buildSearchIndex(): Promise<SearchIndexEntry[]> {
  const [announcements, documents, links] = await Promise.all([
    listAnnouncements(),
    listDocuments(),
    listLinks(),
  ]);

  return [
    ...announcements.map(toAnnouncementEntry),
    ...documents.map(toDocumentEntry),
    ...links.map(toLinkEntry),
  ];
}

function sanitizeQuery(query: string): string {
  return query.trim();
}

function highlight(value: string, tokens: string[]): string {
  if (!tokens.length) {
    return value;
  }

  let highlighted = value;
  for (const token of tokens) {
    if (!token) continue;
    const regex = new RegExp(`(${escapeRegExp(token)})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  }
  return highlighted;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

export async function searchResources(options: {
  query: string;
  userDepartment?: string | null;
  isAdmin?: boolean;
}): Promise<SearchResult[]> {
  const query = sanitizeQuery(options.query);
  if (!query) {
    return [];
  }

  const tokens = tokenize(query);
  const index = await buildSearchIndex();
  const filtered = filterByDepartment(index, options.userDepartment ?? null, {
    allowAllForAdmins: true,
    isAdmin: options.isAdmin ?? false,
  });

  const matched = filtered
    .map((entry) => {
      const haystack =
        `${entry.title} ${entry.description} ${entry.category}`.toLowerCase();
      const isMatch = tokens.every((token) =>
        haystack.includes(token.toLowerCase())
      );
      if (!isMatch) {
        return null;
      }

      return {
        ...entry,
        highlightedTitle: highlight(entry.title, tokens),
        highlightedDescription: highlight(entry.description, tokens),
      } satisfies SearchResult;
    })
    .filter((value): value is SearchResult => value !== null)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  return matched;
}
