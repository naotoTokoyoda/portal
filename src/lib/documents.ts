import {
  addDocumentVersion,
  createDocument,
  updateDocument,
  type ActorDetails,
  type AddDocumentVersionInput,
  type CreateDocumentInput,
  type DocumentRecord,
  type DocumentVersionRecord,
  type UpdateDocumentInput,
} from '@/lib/persistence/resources';

export {
  listDocuments,
  getDocumentById,
  deleteDocument,
} from '@/lib/persistence/resources';

export async function createVersionedDocument(
  input: CreateDocumentInput,
  actor: ActorDetails
): Promise<DocumentRecord> {
  return createDocument(input, actor);
}

export async function updateDocumentMetadata(
  id: string,
  input: UpdateDocumentInput,
  actor: ActorDetails
): Promise<DocumentRecord | null> {
  return updateDocument(id, input, actor);
}

export async function appendDocumentVersion(
  id: string,
  input: AddDocumentVersionInput,
  actor: ActorDetails
): Promise<DocumentRecord | null> {
  return addDocumentVersion(id, input, actor);
}

export function getLatestDocumentVersion(
  document: DocumentRecord
): DocumentVersionRecord | null {
  if (!document.currentVersionId) {
    return null;
  }
  return (
    document.versions.find(
      (version) => version.id === document.currentVersionId
    ) ?? null
  );
}

export function getOrderedVersions(
  document: DocumentRecord
): DocumentVersionRecord[] {
  return [...document.versions].sort((a, b) => b.version - a.version);
}
