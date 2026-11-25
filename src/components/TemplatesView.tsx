import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  LayoutTemplate,
  Pencil,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  CATEGORIES,
  formatDisplayDate,
  getInitials,
  PRIORITIES,
  STATUSES,
} from '../constants';
import { api } from '../services/apiClient';
import {
  DateFormatPref,
  ProjectRecord,
  SubtaskItem,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  TaskTemplateRecord,
  UserProfile,
} from '../types';

interface TemplatesViewProps {
  templates: TaskTemplateRecord[];
  projects: ProjectRecord[];
  users: UserProfile[];
  currentUser: UserProfile;
  dateFormat: DateFormatPref;
  onUseTemplateInModal: (template: TaskTemplateRecord) => void;
  onQuickCreateFromTemplate: (template: TaskTemplateRecord) => Promise<void>;
  onTemplateSaved: (template: TaskTemplateRecord, isNew: boolean) => void;
  onTemplateDeleted: (templateId: number) => void;
  onNotifyToast: (msg: string) => void;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  projects,
  users,
  currentUser,
  dateFormat,
  onUseTemplateInModal,
  onQuickCreateFromTemplate,
  onTemplateSaved,
  onTemplateDeleted,
  onNotifyToast,
}) => {
  const isManagerOrAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [projectFilter, setProjectFilter] = useState<'all' | number>('all');

  const [instantiatingId, setInstantiatingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskTemplateRecord | null>(null);

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('feature');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueOffsetDays, setDueOffsetDays] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (categoryFilter !== 'all' && tpl.category !== categoryFilter) return false;
      if (projectFilter !== 'all' && tpl.projectId !== projectFilter) return false;
      if (q) {
        const hay = `${tpl.name} ${tpl.title} ${tpl.description} ${tpl.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [templates, query, categoryFilter, projectFilter]);

  const openCreateModal = () => {
    setEditing(null);
    setName('');
    setTitle('');
    setDescription('');
    setProjectId(projects[0]?.id ?? '');
    setPriority('medium');
    setCategory('feature');
    setStatus('todo');
    setDueOffsetDays('3');
    setTagsInput('');
    setAssigneeIds(isManagerOrAdmin ? [] : [currentUser.id]);
    setSubtasks([]);
    setNewSubtask('');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (tpl: TaskTemplateRecord) => {
    setEditing(tpl);
    setName(tpl.name);
    setTitle(tpl.title);
    setDescription(tpl.description);
    setProjectId(tpl.projectId ?? '');
    setPriority(tpl.priority);
    setCategory(tpl.category);
    setStatus(tpl.status);
    setDueOffsetDays(tpl.dueOffsetDays === null ? '' : String(tpl.dueOffsetDays));
    setTagsInput(tpl.tags.join(', '));
    setAssigneeIds(tpl.assigneeIds || []);
    setSubtasks(tpl.subtasks || []);
    setNewSubtask('');
    setError('');
    setModalOpen(true);
  };

  const toggleAssignee = (uid: number) => {
    setAssigneeIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleAddSubtask = () => {
    const clean = newSubtask.trim();
    if (!clean) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `tpl-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: clean,
        done: false,
      },
    ]);
    setNewSubtask('');
  };

  const moveSubtask = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= subtasks.length) return;
    setSubtasks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      setError('Template name and default task title are required.');
      return;
    }

    let parsedOffset: number | null = null;
    if (dueOffsetDays.trim() !== '') {
      const n = Number(dueOffsetDays);
      if (!Number.isInteger(n) || n < 0 || n > 365) {
        setError('Due offset must be a whole number between 0 and 365 days.');
        return;
      }
      parsedOffset = n;
    }

    setSaving(true);
    setError('');

    const tags = tagsInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      projectId: projectId === '' ? null : Number(projectId),
      assigneeIds,
      priority,
      category,
      status,
      tags,
      subtasks: subtasks.map((s) => ({ ...s, done: false })),
      dueOffsetDays: parsedOffset,
    };

    try {
      if (editing) {
        const updated = await api.updateTaskTemplate(editing.id, payload);
        onTemplateSaved(updated, false);
      } else {
        const created = await api.createTaskTemplate(payload);
        onTemplateSaved(created, true);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCreate = async (tpl: TaskTemplateRecord) => {
    setInstantiatingId(tpl.id);
    try {
      await onQuickCreateFromTemplate(tpl);
    } finally {
      setInstantiatingId(null);
    }
  };

  const handleDelete = async (tpl: TaskTemplateRecord) => {
    setDeletingId(tpl.id);
    try {
      await api.deleteTaskTemplate(tpl.id);
      setConfirmDeleteId(null);
      onTemplateDeleted(tpl.id);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to delete template.');
    } finally {
      setDeletingId(null);
    }
  };

  const fieldClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="ws-stack">
      {/* Header & Controls */}
      <div className="ws-card ws-card-pad space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Task Templates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Standardize recurring checklists, descriptions, and default assignees into one-click workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl px-4 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates, titles, or tags..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[var(--accent)] focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | TaskCategory)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by project"
            value={projectFilter === 'all' ? 'all' : String(projectFilter)}
            onChange={(e) =>
              setProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="ws-card ws-card-pad flex flex-col items-center justify-center py-12 text-center">
          <LayoutTemplate className="h-9 w-9 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-3 font-display text-sm font-bold text-slate-800 dark:text-slate-100">
            {templates.length === 0 ? 'No task templates yet' : 'No matching templates'}
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            {templates.length === 0
              ? 'Save recurring checklists, instructions, and default assignees so your team can spin up consistent tasks in seconds.'
              : 'Adjust your search query or filters to view other templates.'}
          </p>
          {templates.length === 0 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((tpl) => {
            const project = tpl.projectId ? projectMap.get(tpl.projectId) : null;
            const categoryLabel =
              CATEGORIES.find((c) => c.id === tpl.category)?.label || tpl.category;
            const priorityMeta = PRIORITIES.find((p) => p.id === tpl.priority);
            const assignedUsers = tpl.assigneeIds
              .map((uid) => userMap.get(uid))
              .filter((u): u is UserProfile => Boolean(u));
            const canModify = isManagerOrAdmin || tpl.createdById === currentUser.id;
            const isConfirmingDelete = confirmDeleteId === tpl.id;
            const isInstantiating = instantiatingId === tpl.id;

            return (
              <div
                key={tpl.id}
                className="ws-card ws-card-pad flex flex-col justify-between gap-4 transition-colors hover:border-slate-300 dark:hover:border-slate-600"
              >
                <div className="space-y-3">
                  {/* Top Title & Management Icons */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-bold text-slate-900 dark:text-slate-50">
                        {tpl.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                        Default Title: {tpl.title}
                      </p>
                    </div>

                    {canModify && !isConfirmingDelete && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(tpl)}
                          aria-label={`Edit ${tpl.name}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(tpl.id)}
                          aria-label={`Delete ${tpl.name}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Delete Confirmation */}
                  {isConfirmingDelete && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs dark:border-red-900/80 dark:bg-red-950/50">
                      <span className="font-medium text-red-700 dark:text-red-300">
                        Delete this template?
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === tpl.id}
                          onClick={() => void handleDelete(tpl)}
                          className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                        >
                          {deletingId === tpl.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Metadata Line (Zero-pill, dot-separated) */}
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span>{project ? project.name : 'Project selected on use'}</span>
                    <span>·</span>
                    <span>{categoryLabel}</span>
                    <span>·</span>
                    <span
                      className={
                        tpl.priority === 'high'
                          ? 'font-semibold text-red-600 dark:text-red-400'
                          : tpl.priority === 'medium'
                            ? 'font-semibold text-amber-600 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {priorityMeta?.label || tpl.priority} Priority
                    </span>
                    {tpl.dueOffsetDays !== null && (
                      <>
                        <span>·</span>
                        <span className="font-mono tabular-nums">Due +{tpl.dueOffsetDays}d</span>
                      </>
                    )}
                  </div>

                  {/* Description */}
                  {tpl.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {tpl.description}
                    </p>
                  )}

                  {/* Subtask Checklist Preview */}
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5 ws-accent-text" />
                        Checklist ({tpl.subtasks.length} steps)
                      </span>
                      {tpl.tags.length > 0 && (
                        <span className="truncate font-mono text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          {tpl.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
                        </span>
                      )}
                    </div>
                    {tpl.subtasks.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {tpl.subtasks.slice(0, 3).map((sub) => (
                          <li
                            key={sub.id}
                            className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300"
                          >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-slate-300 dark:border-slate-600" />
                            <span className="truncate">{sub.title}</span>
                          </li>
                        ))}
                        {tpl.subtasks.length > 3 && (
                          <li className="pl-4 text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                            +{tpl.subtasks.length - 3} more checklist item(s)
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                        No predefined subtasks
                      </p>
                    )}
                  </div>

                  {/* Predefined Assignees */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {assignedUsers.length > 0 ? (
                        <span className="truncate">
                          {assignedUsers.map((u) => u.name).join(', ')}
                        </span>
                      ) : (
                        <span>No default assignees</span>
                      )}
                    </div>
                    {assignedUsers.length > 0 && (
                      <div className="flex shrink-0 -space-x-1.5">
                        {assignedUsers.slice(0, 3).map((u) => (
                          <span
                            key={u.id}
                            title={u.name}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-200 font-mono text-[10px] font-bold text-slate-700 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-100"
                          >
                            {getInitials(u.name)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                    Updated {formatDisplayDate(tpl.updatedAt, dateFormat)}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUseTemplateInModal(tpl)}
                      className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      Customize
                    </button>
                    <button
                      type="button"
                      disabled={isInstantiating}
                      onClick={() => void handleQuickCreate(tpl)}
                      className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ws-accent-bg disabled:opacity-60 cursor-pointer"
                    >
                      <Play className="h-3 w-3" />
                      {isInstantiating ? 'Creating...' : 'Create Task'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Template Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="ws-card max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  {editing ? 'Edit Task Template' : 'Create Task Template'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure reusable defaults for recurring team workflows.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close template modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Template Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Weekly Release Checklist"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Default Task Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Weekly Production Release Verification"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Default Project
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) =>
                      setProjectId(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className={fieldClass}
                  >
                    <option value="">Choose on use</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className={fieldClass}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskCategory)}
                    className={fieldClass}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className={fieldClass}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Due Date Offset (Days after creation)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={dueOffsetDays}
                    onChange={(e) => setDueOffsetDays(e.target.value)}
                    placeholder="Optional (e.g., 3)"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="release, qa, recurring"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Predefined Assignees ({assigneeIds.length} selected)
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {users.map((u) => {
                    const selected = assigneeIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleAssignee(u.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'ws-accent-soft font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {u.name} ({u.role})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Default Description & Instructions
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Standard instructions, definition of done, or rollout notes..."
                  className={fieldClass}
                />
              </div>

              {/* Subtasks Builder */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <CheckSquare className="h-4 w-4 ws-accent-text" />
                  Predefined Sub-tasks ({subtasks.length})
                </div>

                <div className="mt-3 space-y-2">
                  {subtasks.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                        <span className="mr-2 font-mono text-[10px] text-slate-400 tabular-nums">
                          {idx + 1}.
                        </span>
                        {sub.title}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSubtask(idx, -1)}
                          aria-label="Move step up"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === subtasks.length - 1}
                          onClick={() => moveSubtask(idx, 1)}
                          aria-label="Move step down"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSubtasks((prev) => prev.filter((item) => item.id !== sub.id))
                          }
                          aria-label="Remove step"
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubtask();
                        }
                      }}
                      placeholder="Add checklist step..."
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg px-5 py-2 text-xs font-semibold ws-accent-bg disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editing ? 'Save Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
