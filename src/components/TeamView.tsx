import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { getInitials } from '../constants';
import { api } from '../services/apiClient';
import { TaskRecord, UserProfile, UserRole } from '../types';

interface TeamViewProps {
  users: UserProfile[];
  tasks: TaskRecord[];
  currentUser: UserProfile;
  onUserAdded: (u: UserProfile) => void;
  onUserUpdated: (u: UserProfile) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  users,
  tasks,
  currentUser,
  onUserAdded,
  onUserUpdated,
}) => {
  const isManagerOrAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [department, setDepartment] = useState('Engineering');
  const [jobTitle, setJobTitle] = useState('Software Engineer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.inviteUser({
        name,
        email,
        password,
        role,
        department,
        jobTitle,
      });
      onUserAdded(created);
      setInviteOpen(false);
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add team member.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: number, nextRole: UserRole) => {
    try {
      const updated = await api.updateUser(userId, { role: nextRole });
      onUserUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update member role.');
    }
  };

  const handleToggleActive = async (member: UserProfile) => {
    try {
      const updated = await api.updateUser(member.id, { isActive: !member.isActive });
      onUserUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update member status.');
    }
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="ws-stack">
      <div className="ws-card ws-card-pad flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Team & Role Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage workspace members, departments, active workloads, and role permissions.
          </p>
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setInviteOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="ws-card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
            <tr>
              <th className="ws-cell">Member</th>
              <th className="ws-cell">Department & Title</th>
              <th className="ws-cell">Role</th>
              <th className="ws-cell">Assigned Workload</th>
              <th className="ws-cell">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((member) => {
              const memberTasks = tasks.filter(
                (t) => t.assigneeId === member.id || t.assigneeIds.includes(member.id)
              );
              const openCount = memberTasks.filter((t) => t.status !== 'completed').length;
              const doneCount = memberTasks.filter((t) => t.status === 'completed').length;

              return (
                <tr key={member.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="ws-cell">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] font-mono text-xs font-semibold text-white dark:bg-slate-700">
                        {getInitials(member.name)}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="ws-cell">
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {member.department}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {member.jobTitle}
                    </div>
                  </td>

                  <td className="ws-cell">
                    {isManagerOrAdmin && member.id !== currentUser.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => void handleRoleChange(member.id, e.target.value as UserRole)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold capitalize text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        {currentUser.role === 'admin' && <option value="admin">Admin</option>}
                      </select>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {member.role}
                      </span>
                    )}
                  </td>

                  <td className="ws-cell font-mono tabular-nums">
                    <span className="font-semibold ws-accent-text">{openCount} active</span>
                    <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{doneCount} done</span>
                  </td>

                  <td className="ws-cell">
                    {isManagerOrAdmin && member.id !== currentUser.id ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(member)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                          member.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {member.isActive ? 'Active' : 'Inactive'}
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="ws-card w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Add Team Member
              </h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Initial Password (8+ chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    {currentUser.role === 'admin' && <option value="admin">Admin</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Job Title
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
                >
                  {saving ? 'Adding...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
