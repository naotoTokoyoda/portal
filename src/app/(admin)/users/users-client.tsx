'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type {
  UserActionRecord,
  UserRecord,
  UserRole,
} from '@/lib/persistence/users';

type UsersClientProps = {
  initialUsers: UserRecord[];
  initialActions: UserActionRecord[];
  currentAdminId: string;
};

type FormState = {
  name: string;
  email: string;
  department: string;
  role: UserRole;
  password: string;
  confirmPassword: string;
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  user: 'User',
};

function sortActions(actions: UserActionRecord[]): UserActionRecord[] {
  return [...actions].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const defaultFormState: FormState = {
  name: '',
  email: '',
  department: '',
  role: 'user',
  password: '',
  confirmPassword: '',
};

export function UsersClient({
  initialUsers,
  initialActions,
  currentAdminId,
}: UsersClientProps) {
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [actions, setActions] = useState<UserActionRecord[]>(initialActions);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUsers[0]?.id ?? null
  );
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [passwordInputs, setPasswordInputs] = useState({
    password: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    setPasswordInputs({ password: '', confirmPassword: '' });
    setPasswordError(null);
  }, [selectedUserId]);

  const actionsByUser = useMemo(() => {
    const grouped = new Map<string, UserActionRecord[]>();
    for (const action of actions) {
      const existing = grouped.get(action.userId) ?? [];
      grouped.set(action.userId, [...existing, action]);
    }
    for (const [key, list] of grouped) {
      grouped.set(key, sortActions(list));
    }
    return grouped;
  }, [actions]);

  const selectedUser = selectedUserId
    ? (users.find((user) => user.id === selectedUserId) ?? null)
    : null;

  const selectedHistory = selectedUserId
    ? (actionsByUser.get(selectedUserId) ?? [])
    : [];

  const isSelf = selectedUser?.id === currentAdminId;

  const handleFormChange = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordInputChange = (
    field: 'password' | 'confirmPassword',
    value: string
  ) => {
    setPasswordInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetPassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setPasswordError(null);
    setToast(null);

    if (!selectedUser) {
      return;
    }

    if (!passwordInputs.password || passwordInputs.password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    if (passwordInputs.password !== passwordInputs.confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInputs.password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setPasswordError(payload.error ?? 'Failed to update password.');
        return;
      }

      const updatedUser = payload.user as UserRecord;
      const userActions = payload.actions as UserActionRecord[];
      setUsers((prev) =>
        sortUsers(
          prev.map((candidate) =>
            candidate.id === updatedUser.id ? updatedUser : candidate
          )
        )
      );
      setActions((prev) =>
        sortActions([
          ...prev.filter((action) => action.userId !== updatedUser.id),
          ...userActions,
        ])
      );
      setToast({
        type: 'success',
        message: `Updated password for ${updatedUser.email}.`,
      });
      setPasswordInputs({ password: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'Failed to update password.'
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setToast(null);

    if (!formState.password || formState.password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (formState.password !== formState.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          department: formState.department,
          role: formState.role,
          password: formState.password,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setFormError(payload.error ?? 'Failed to create user.');
        return;
      }

      const createdUser = payload.user as UserRecord;
      const createdActions = payload.actions as UserActionRecord[];
      setUsers((prev) => sortUsers([createdUser, ...prev]));
      setActions((prev) => sortActions([...prev, ...createdActions]));
      setSelectedUserId(createdUser.id);
      setFormState({ ...defaultFormState });
      setToast({
        type: 'success',
        message: `Created user ${createdUser.email}`,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unknown error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRole = (user: UserRecord) => {
    if (user.id === currentAdminId) {
      setToast({
        type: 'error',
        message: 'You cannot change your own administrative role.',
      });
      return;
    }
    const nextRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    setToast(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: nextRole }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setToast({
            type: 'error',
            message: payload.error ?? 'Failed to update user.',
          });
          return;
        }

        const updatedUser = payload.user as UserRecord;
        const userActions = payload.actions as UserActionRecord[];
        setUsers((prev) =>
          sortUsers(
            prev.map((candidate) =>
              candidate.id === user.id ? updatedUser : candidate
            )
          )
        );
        setActions((prev) =>
          sortActions([
            ...prev.filter((action) => action.userId !== user.id),
            ...userActions,
          ])
        );
        setToast({
          type: 'success',
          message: `Updated role for ${updatedUser.email} to ${roleLabel[updatedUser.role]}.`,
        });
      } catch (error) {
        setToast({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Failed to update user.',
        });
      }
    });
  };

  const handleDeleteUser = async (user: UserRecord) => {
    if (user.id === currentAdminId) {
      setToast({
        type: 'error',
        message: 'You cannot delete your own account.',
      });
      return;
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Delete ${user.email}? This action cannot be undone.`
      );
      if (!confirmed) return;
    }

    setToast(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/users/${user.id}`, {
          method: 'DELETE',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setToast({
            type: 'error',
            message: payload.error ?? 'Failed to delete user.',
          });
          return;
        }

        setUsers((prev) =>
          prev.filter((candidate) => candidate.id !== user.id)
        );
        setActions((prev) =>
          prev.filter((action) => action.userId !== user.id)
        );
        if (selectedUserId === user.id) {
          setSelectedUserId(null);
        }
        setToast({ type: 'success', message: `Deleted ${user.email}.` });
      } catch (error) {
        setToast({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Failed to delete user.',
        });
      }
    });
  };

  return (
    <div className="space-y-10">
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Add a user</h2>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateUser}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Full name</span>
            <input
              className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              value={formState.name}
              onChange={(event) => handleFormChange('name', event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              value={formState.email}
              onChange={(event) =>
                handleFormChange('email', event.target.value)
              }
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Department</span>
            <input
              className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              value={formState.department}
              onChange={(event) =>
                handleFormChange('department', event.target.value)
              }
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Role</span>
            <select
              className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              value={formState.role}
              onChange={(event) =>
                handleFormChange('role', event.target.value as UserRole)
              }
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              value={formState.password}
              onChange={(event) =>
                handleFormChange('password', event.target.value)
              }
              required
              minLength={8}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Confirm password</span>
            <input
              type="password"
              className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              value={formState.confirmPassword}
              onChange={(event) =>
                handleFormChange('confirmPassword', event.target.value)
              }
              required
              minLength={8}
            />
          </label>
          {formError ? (
            <p className="text-sm text-destructive md:col-span-2">
              {formError}
            </p>
          ) : null}
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create user'}
            </Button>
            {toast ? (
              <span
                className={`text-sm ${
                  toast.type === 'success'
                    ? 'text-emerald-600'
                    : 'text-destructive'
                }`}
              >
                {toast.message}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card shadow-sm">
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold">Users</h2>
              <p className="text-sm text-muted-foreground">
                Toggle roles between general users and administrators for any
                account.
              </p>
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Department
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Last login
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => {
                  const isCurrentAdmin = user.id === currentAdminId;
                  const isActive = selectedUserId === user.id;
                  return (
                    <tr
                      key={user.id}
                      className={`${isActive ? 'bg-muted/40' : ''} hover:bg-muted/30 cursor-pointer`}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        {user.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-sm">{user.department}</td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {roleLabel[user.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatTimestamp(user.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending || isCurrentAdmin}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleRole(user);
                            }}
                          >
                            {user.role === 'admin' ? 'Demote' : 'Promote'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            disabled={isPending || isCurrentAdmin}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteUser(user);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-lg border bg-card shadow-sm">
          <header className="border-b px-6 py-4">
            <h2 className="text-xl font-semibold">Activity</h2>
            <p className="text-sm text-muted-foreground">
              All role changes and updates for the selected user.
            </p>
          </header>
          <div className="h-full max-h-[32rem] overflow-y-auto px-6 py-4">
            {selectedUser ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Role: {roleLabel[selectedUser.role]} · Department:{' '}
                    {selectedUser.department}
                  </p>
                </div>
                <form
                  className="space-y-3 rounded-md border px-3 py-3"
                  onSubmit={handleResetPassword}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">Set new password</h4>
                    <span className="text-xs text-muted-foreground">
                      Minimum 8 characters
                    </span>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      value={passwordInputs.password}
                      onChange={(event) =>
                        handlePasswordInputChange(
                          'password',
                          event.target.value
                        )
                      }
                      minLength={8}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Confirm password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      value={passwordInputs.confirmPassword}
                      onChange={(event) =>
                        handlePasswordInputChange(
                          'confirmPassword',
                          event.target.value
                        )
                      }
                      minLength={8}
                    />
                  </label>
                  {passwordError ? (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  ) : null}
                  <Button type="submit" size="sm" disabled={isUpdatingPassword}>
                    {isUpdatingPassword ? 'Saving…' : 'Save new password'}
                  </Button>
                </form>
                <ul className="space-y-3">
                  {selectedHistory.length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      No actions recorded.
                    </li>
                  ) : (
                    selectedHistory.map((action) => (
                      <li
                        key={action.id}
                        className="rounded-md border px-3 py-2 text-sm"
                      >
                        <p className="font-medium capitalize">
                          {action.type.replace('_', ' ')}
                        </p>
                        <p className="text-muted-foreground">
                          {action.summary}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(action.timestamp)}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a user to view their history.
              </p>
            )}
          </div>
          {isSelf ? (
            <footer className="border-t bg-muted/60 px-6 py-3 text-xs text-muted-foreground">
              You are viewing your own account. Role changes for your identity
              are disabled to prevent accidental lockout.
            </footer>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function sortUsers(users: UserRecord[]): UserRecord[] {
  return [...users].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
