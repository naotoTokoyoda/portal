import type { ResourceDepartmentScope } from '@/lib/persistence/resources';

export function normalizeDepartments(
  departments: ResourceDepartmentScope
): ResourceDepartmentScope {
  return departments
    .map((department) => department.trim())
    .filter((department) => department.length > 0);
}

export function parseDepartmentInput(input: string): ResourceDepartmentScope {
  if (!input) {
    return [];
  }
  return normalizeDepartments(input.split(',').map((value) => value.trim()));
}

export function formatDepartments(
  departments: ResourceDepartmentScope
): string {
  if (!departments.length) {
    return 'All Departments';
  }
  return departments.join(', ');
}

export function hasDepartmentAccess(
  userDepartment: string | null | undefined,
  departments: ResourceDepartmentScope,
  options: { allowAllForAdmins?: boolean; isAdmin?: boolean } = {}
): boolean {
  const normalized = normalizeDepartments(departments);
  if (!normalized.length) {
    return true;
  }

  if (options.allowAllForAdmins && options.isAdmin) {
    return true;
  }

  if (!userDepartment) {
    return normalized.includes('public');
  }

  const normalizedUser = userDepartment.trim();
  return normalized.includes(normalizedUser);
}

export function filterByDepartment<
  T extends { departments: ResourceDepartmentScope },
>(
  items: T[],
  userDepartment: string | null | undefined,
  options: { allowAllForAdmins?: boolean; isAdmin?: boolean } = {}
): T[] {
  return items.filter((item) =>
    hasDepartmentAccess(userDepartment, item.departments, options)
  );
}
