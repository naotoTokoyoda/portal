import { UserRole } from '@/lib/persistence/users';

type StringRecord = Record<string, string>;

type RoleMapping = Record<string, UserRole>;

type GroupRoleMapping = Record<string, UserRole>;

const DEFAULT_DEPARTMENT = 'General';

const DEFAULT_ROLE_MAPPING: RoleMapping = {
  Engineering: 'admin',
  IT: 'admin',
  Security: 'admin',
  Operations: 'user',
  Finance: 'user',
  Marketing: 'user',
  Sales: 'user',
  People: 'user',
  HR: 'user',
  General: 'user',
};

let cachedDepartmentRoleMapping: RoleMapping | null = null;
let cachedDomainDepartmentMapping: StringRecord | null = null;
let cachedGroupRoleMapping: GroupRoleMapping | null = null;

function parseJsonRecord(value: string | undefined): StringRecord {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as StringRecord;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, recordValue]) => [
        key.trim().toLowerCase(),
        recordValue,
      ])
    );
  } catch (error) {
    console.warn('Failed to parse JSON mapping from env', error);
    return {};
  }
}

function parseRoleMapping(value: string | undefined): RoleMapping {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    const mapping: RoleMapping = {};
    for (const [key, recordValue] of Object.entries(parsed)) {
      const role =
        recordValue === 'admin'
          ? 'admin'
          : recordValue === 'user'
            ? 'user'
            : null;
      if (!role) continue;
      mapping[key.trim()] = role;
    }
    return mapping;
  } catch (error) {
    console.warn('Failed to parse role mapping from env', error);
    return {};
  }
}

function parseGroupRoleMapping(value: string | undefined): GroupRoleMapping {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    const mapping: GroupRoleMapping = {};
    for (const [group, roleValue] of Object.entries(parsed)) {
      const role =
        roleValue === 'admin' ? 'admin' : roleValue === 'user' ? 'user' : null;
      if (!role) continue;
      mapping[group.toLowerCase()] = role;
    }
    return mapping;
  } catch (error) {
    console.warn('Failed to parse group role mapping from env', error);
    return {};
  }
}

export function getDomainDepartmentMapping(): StringRecord {
  if (cachedDomainDepartmentMapping) return cachedDomainDepartmentMapping;
  const mapping = parseJsonRecord(process.env.DOMAIN_DEPARTMENT_MAPPING);
  cachedDomainDepartmentMapping = mapping;
  return mapping;
}

export function getDepartmentRoleMapping(): RoleMapping {
  if (cachedDepartmentRoleMapping) return cachedDepartmentRoleMapping;
  const mapping = {
    ...DEFAULT_ROLE_MAPPING,
    ...parseRoleMapping(process.env.DEPARTMENT_ROLE_MAPPING),
  };
  cachedDepartmentRoleMapping = mapping;
  return mapping;
}

export function getGroupRoleMapping(): GroupRoleMapping {
  if (cachedGroupRoleMapping) return cachedGroupRoleMapping;
  const mapping = parseGroupRoleMapping(process.env.GROUP_ROLE_MAPPING);
  cachedGroupRoleMapping = mapping;
  return mapping;
}

function normalizeDepartment(department?: string | null): string | null {
  if (!department) return null;
  const trimmed = department.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDepartmentFromIdentity(
  email: string | undefined,
  department?: string | null
): string {
  const explicit = normalizeDepartment(department);
  if (explicit) return explicit;

  const domainMapping = getDomainDepartmentMapping();
  const domain = email?.split('@')[1]?.toLowerCase();
  if (domain && domainMapping[domain]) {
    return domainMapping[domain];
  }

  return DEFAULT_DEPARTMENT;
}

export function resolveRoleFromDepartment(
  department: string,
  groups?: string[] | null
): UserRole {
  const mapping = getDepartmentRoleMapping();
  if (mapping[department]) {
    return mapping[department];
  }

  const groupMapping = getGroupRoleMapping();
  if (groups) {
    for (const group of groups) {
      const normalized = group.toLowerCase();
      if (groupMapping[normalized]) {
        return groupMapping[normalized];
      }
    }
  }

  return 'user';
}

export function resetAuthConfigCaches(): void {
  cachedDepartmentRoleMapping = null;
  cachedDomainDepartmentMapping = null;
  cachedGroupRoleMapping = null;
}
