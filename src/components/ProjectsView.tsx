import React, { useState } from 'react';
import { Calendar, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import { formatDisplayDate, PROJECT_COLORS, PROJECT_STATUSES } from '../constants';
import { api } from '../services/apiClient';
import { DateFormatPref, ProjectRecord, ProjectStatus, UserProfile } from '../types';

interface ProjectsViewProps {
  projects: ProjectRecord[];
  users: UserProfile[];
  dateFormat: DateFormatPref;
  isManagerOrAdmin: boolean;
  onSelectProjectTasks: (projectId: number) => void;
  onProjectSaved: (project: ProjectRecord, isNew: boolean) => void;
  onProjectDeleted: (projectId: number) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  users,
  dateFormat,
  isManagerOrAdmin,
  onSelectProjectTasks,
  onProjectSaved,
  onProjectDeleted,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRecord | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [deadline, setDeadline] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setColor(PROJECT_COLORS[0]);
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setDeadline(today);
    setStatus('active');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: ProjectRecord) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setColor(p.color);
    setStartDate(p.startDate);
    setDeadline(p.deadline);
    setStatus(p.status);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const updated = await api.updateProject(editing.id, {
          name: name.trim(),
          description: description.trim(),
          color,
          startDate,
          deadline,
          status,
        });
        onProjectSaved(updated, false);
      } else {
        const created = await api.createProject({
          name: name.trim(),
          description: description.trim(),
          color,
          startDate,
          deadline,
          status,
        });
        onProjectSaved(created, true);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteProject(id);
      onProjectDeleted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project.');
    }
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="ws-stack">
      <div className="ws-card ws-card-pad flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Projects Portfolio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track milestones, deadlines, and completion across active initiatives.
          </p>
        </div>
        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            New Project
          </button>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {projects.map((p) => {
          const st = PROJECT_STATUSES.find((s) => s.id === p.status);
          const progress = p.progress ?? 0;
          return (
            <div
              key={p.id}
              className="ws-card ws-card-pad flex flex-col justify-between transition-colors hover:border-slate-300 dark:hover:border-slate-600"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {p.name}
                    </h3>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                      st?.badgeClass || ''
                    }`}
                  >
                    {st?.label || p.status}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {p.description || 'No project brief added yet.'}
                </p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Completion</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      {p.completedCount ?? 0}/{p.taskCount ?? 0} tasks ({progress}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progress}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5 text-xs dark:border-slate-800">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                    <Calendar className="h-3.5 w-3.5" />
                    Due {formatDisplayDate(p.deadline, dateFormat)}
                  </span>
                  <span>Lead: {userMap.get(p.ownerId) || 'Manager'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectProjectTasks(p.id)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    View Tasks
                  </button>
                  {isManagerOrAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        title="Edit project"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(p.id)}
                        title="Delete project"
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/60 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="ws-card w-full max-w-lg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                {editing ? 'Edit Project' : 'Create Project'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project Name
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
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Accent Color
                </label>
                <div className="mt-1.5 flex gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full cursor-pointer ${
                        color === c ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
                >
                  {saving ? 'Saving...' : editing ? 'Save Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
