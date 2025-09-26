import { createHash, createHmac, randomUUID } from 'crypto';

type Nullable<T> = T | null | undefined;

export interface AccessLogInput {
  actorId?: Nullable<string>;
  actorRole?: Nullable<string>;
  actorDepartment?: Nullable<string>;
  actorIp?: Nullable<string>;
  method: string;
  resource: string;
  statusCode: number;
  userAgent?: Nullable<string>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogInput {
  action: string;
  actorId?: Nullable<string>;
  actorRole?: Nullable<string>;
  targetId?: Nullable<string>;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface PersistedLog {
  type: 'access' | 'audit';
  occurredAt: string;
  payload: Record<string, unknown>;
}

const LOG_ARCHIVE_BUCKET = process.env.LOG_ARCHIVE_BUCKET;
const LOG_ARCHIVE_PREFIX = process.env.LOG_ARCHIVE_PREFIX ?? 'portal';
const LOG_ARCHIVE_SSE = process.env.LOG_ARCHIVE_SSE ?? 'AES256';
const LOG_ARCHIVE_STORAGE_CLASS =
  process.env.LOG_ARCHIVE_STORAGE_CLASS ?? 'STANDARD_IA';
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
const LOG_ARCHIVE_ENDPOINT = process.env.LOG_ARCHIVE_ENDPOINT;

function ensureServerRuntime() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Logging utilities are only available on the server runtime.'
    );
  }
}

function buildLogKey(type: PersistedLog['type'], occurredAt: string) {
  const datePrefix = occurredAt.slice(0, 10); // YYYY-MM-DD
  return `${LOG_ARCHIVE_PREFIX}/${type}/${datePrefix}/${occurredAt}-${randomUUID()}.json`;
}

function sha256Hex(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function hmac(key: string | Buffer, data: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = createHmac('sha256', kDate)
    .update(regionName, 'utf8')
    .digest();
  const kService = createHmac('sha256', kRegion)
    .update(serviceName, 'utf8')
    .digest();
  return createHmac('sha256', kService).update('aws4_request', 'utf8').digest();
}

async function putObjectToS3(key: string, body: string) {
  if (!LOG_ARCHIVE_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.info(
      '[logging] Persistent store is not configured; falling back to console.'
    );
    console.info(body);
    return;
  }

  const isoDate = new Date().toISOString().replace(/[:-]|\..{3}/g, '');
  const dateStamp = isoDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const host =
    LOG_ARCHIVE_ENDPOINT?.trim() ??
    `${LOG_ARCHIVE_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
  const canonicalUri = `/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  const requestUrl = `https://${host}${canonicalUri}`;

  const headerMap = new Map<string, string>([
    ['content-type', 'application/json'],
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', isoDate],
    ['x-amz-server-side-encryption', LOG_ARCHIVE_SSE],
    ['x-amz-storage-class', LOG_ARCHIVE_STORAGE_CLASS],
  ]);

  if (AWS_SESSION_TOKEN) {
    headerMap.set('x-amz-security-token', AWS_SESSION_TOKEN);
  }

  const sortedHeaders = Array.from(headerMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const canonicalHeaders = sortedHeaders
    .map(([key, value]) => `${key}:${value.trim()}`)
    .join('\n');
  const signedHeaders = sortedHeaders.map(([key]) => key).join(';');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${AWS_REGION}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    isoDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(
    AWS_SECRET_ACCESS_KEY,
    dateStamp,
    AWS_REGION,
    's3'
  );

  const signature = createHmac('sha256', signingKey)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = Object.fromEntries(
    sortedHeaders.map(([key, value]) => [key, value])
  ) as Record<string, string>;
  requestHeaders.authorization = authorization;

  const response = await fetch(requestUrl, {
    method: 'PUT',
    body,
    headers: requestHeaders,
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Failed to upload log to S3 (${response.status} ${response.statusText}): ${responseText}`
    );
  }
}

async function persistLog(entry: PersistedLog) {
  ensureServerRuntime();

  const body = JSON.stringify(entry);
  try {
    await putObjectToS3(buildLogKey(entry.type, entry.occurredAt), body);
  } catch (error) {
    console.error('Failed to persist log entry', error);
    console.info('Falling back to console log for observability.');
    console.info(body);
  }
}

export async function logAccess(input: AccessLogInput) {
  const occurredAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    actorDepartment: input.actorDepartment ?? null,
    actorIp: input.actorIp ?? null,
    method: input.method,
    resource: input.resource,
    statusCode: input.statusCode,
    userAgent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
  };

  await persistLog({ type: 'access', occurredAt, payload });
}

export async function logAudit(input: AuditLogInput) {
  const occurredAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    action: input.action,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    targetId: input.targetId ?? null,
    description: input.description ?? null,
    metadata: input.metadata ?? {},
  };

  await persistLog({ type: 'audit', occurredAt, payload });
}
