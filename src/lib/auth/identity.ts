export interface NormalizedIdentityProfile {
  email: string;
  name?: string | null;
  department?: string | null;
  groups?: string[] | null;
  provider?: string;
  raw?: Record<string, unknown> | null;
}

function extractArray(value: unknown): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean);
  }
  return null;
}

function coalesceEmail(
  profile: Record<string, unknown> | null | undefined,
  fallback?: string | null
): string {
  const candidates = [
    typeof profile?.['email'] === 'string'
      ? (profile['email'] as string)
      : null,
    typeof profile?.['mail'] === 'string' ? (profile['mail'] as string) : null,
    typeof profile?.['upn'] === 'string' ? (profile['upn'] as string) : null,
    typeof profile?.['preferred_username'] === 'string'
      ? (profile['preferred_username'] as string)
      : null,
    fallback ?? null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const email = candidates.find(Boolean);
  if (!email) {
    throw new Error(
      'Unable to determine identity email address from provider payload.'
    );
  }
  return email;
}

export function normalizeIdentityProfile(
  provider: string,
  profile: Record<string, unknown> | undefined,
  user?: { email?: string | null; name?: string | null }
): NormalizedIdentityProfile {
  const email = coalesceEmail(profile, user?.email ?? null).toLowerCase();
  const nameCandidate =
    (typeof profile?.['name'] === 'string' && (profile['name'] as string)) ||
    (typeof profile?.['displayName'] === 'string' &&
      (profile['displayName'] as string)) ||
    user?.name ||
    email;

  let department: string | null = null;
  if (typeof profile?.['department'] === 'string') {
    department = profile['department'] as string;
  } else if (typeof profile?.['hd'] === 'string') {
    department = profile['hd'] as string;
  } else if (typeof profile?.['orgUnitPath'] === 'string') {
    department = profile['orgUnitPath'] as string;
  }

  let groups: string[] | null = null;
  if (provider === 'azure-ad') {
    groups =
      extractArray(profile?.['roles']) ?? extractArray(profile?.['groups']);
  } else if (provider === 'google') {
    groups = extractArray(profile?.['groups']);
  } else {
    groups = extractArray(profile?.['groups']);
  }

  return {
    email,
    name: nameCandidate,
    department,
    groups,
    provider,
    raw: profile ?? null,
  };
}
