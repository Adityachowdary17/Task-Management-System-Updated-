import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckSquare,
  Download,
  LayoutTemplate,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CATEGORIES,
  formatDisplayDate,
  formatRelativeTime,
  PRIORITIES,
  STATUSES,
} from '../constants';
import { api } from '../services/apiClient';
import {
  CommentRecord,
  DateFormatPref,
  ProjectRecord,
  SubtaskItem,
  TaskCategory,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  TaskTemplateRecord,
  UserProfile,
} from '../types';

interface TaskModalProps {
  isOpen: boolean;
  task: TaskRecord | null;
  templates: TaskTemplateRecord[];
  prefillTemplate?: TaskTemplateRecord | null;
  projects: ProjectRecord[];
  users: UserProfile[];
  currentUser: UserProfile;
  dateFormat: DateFormatPref;
  onClose: () => void;
  onSaved: (task: TaskRecord) => void;
  onDeleted: (taskId: number) => void;
  onTemplateSaved?: (template: TaskTemplateRecord) => void;
  onNotifyToast: (msg: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  task,
  templates,
  prefillTemplate,
  projects,
  users,
  currentUser,
  dateFormat,
  onClose,
  onSaved,
  onDeleted,
  onTemplateSaved,
  onNotifyToast,
}) => {
  const isManagerOrAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<number>(projects[0]?.id || 1);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('feature');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [archived, setArchived] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [templateDueOffsetInput, setTemplateDueOffsetInput] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const computeOffsetDate = (offsetDays: number | null): string => {
    if (offsetDays === null || offsetDays < 0) return '';
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  const applyTemplateFields = (tpl: TaskTemplateRecord) => {
    setTitle(tpl.title);
    setDescription(tpl.description);
    const matchedProject =
      tpl.projectId && projects.some((p) => p.id === tpl.projectId)
        ? tpl.projectId
        : projects[0]?.id || 1;
    setProjectId(matchedProject);
    setStatus(tpl.status);
    setPriority(tpl.priority);
    setCategory(tpl.category);
    setDueDate(computeOffsetDate(tpl.dueOffsetDays));
    if (isManagerOrAdmin) {
      const userIdSet = new Set(users.map((u) => u.id));
      setAssigneeIds(tpl.assigneeIds.filter((id) => userIdSet.has(id)));
    } else {
      setAssigneeIds([currentUser.id]);
    }
    setTagsInput(tpl.tags.join(', '));
    setSubtasks(
      tpl.subtasks.map((item, idx) => ({
        id: `sub-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        title: item.title,
        done: false,
      }))
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSaveTemplateOpen(false);
    setTemplateNameInput('');
    setTemplateDueOffsetInput('');
    if (task) {
      setSelectedTemplateId('');
      setTitle(task.title);
      setDescription(task.description);
      setProjectId(task.projectId);
      setStatus(task.status);
      setPriority(task.priority);
      setCategory(task.category);
      setDueDate(task.dueDate);
      setAssigneeIds(
        task.assigneeIds.length > 0 ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : []
      );
      setTagsInput(task.tags.join(', '));
      setSubtasks(task.subtasks || []);
      setArchived(Boolean(task.archived));
      api
        .getComments(task.id)
        .then(setComments)
        .catch(() => setComments([]));
    } else if (prefillTemplate) {
      setSelectedTemplateId(String(prefillTemplate.id));
      setArchived(false);
      setComments([]);
      setTitle(prefillTemplate.title);
      setDescription(prefillTemplate.description);
      const matchedProject =
        prefillTemplate.projectId && projects.some((p) => p.id === prefillTemplate.projectId)
          ? prefillTemplate.projectId
          : projects[0]?.id || 1;
      setProjectId(matchedProject);
      setStatus(prefillTemplate.status);
      setPriority(prefillTemplate.priority);
      setCategory(prefillTemplate.category);
      setDueDate(computeOffsetDate(prefillTemplate.dueOffsetDays));
      if (isManagerOrAdmin) {
        const userIdSet = new Set(users.map((u) => u.id));
        setAssigneeIds(prefillTemplate.assigneeIds.filter((id) => userIdSet.has(id)));
      } else {
        setAssigneeIds([currentUser.id]);
      }
      setTagsInput(prefillTemplate.tags.join(', '));
      setSubtasks(
        prefillTemplate.subtasks.map((item, idx) => ({
          id: `sub-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          title: item.title,
          done: false,
        }))
      );
    } else {
      setSelectedTemplateId('');
      setTitle('');
      setDescription('');
      setProjectId(projects[0]?.id || 1);
      setStatus('todo');
      setPriority('medium');
      setCategory('feature');
      setDueDate('');
      setAssigneeIds(isManagerOrAdmin ? [] : [currentUser.id]);
      setTagsInput('');
      setSubtasks([]);
      setArchived(false);
      setComments([]);
    }
  }, [isOpen, task, prefillTemplate, projects, users, isManagerOrAdmin, currentUser.id]);

  if (!isOpen) return null;

  const handleTemplateSelectChange = (rawId: string) => {
    setSelectedTemplateId(rawId);
    if (!rawId) {
      setTitle('');
      setDescription('');
      setProjectId(projects[0]?.id || 1);
      setStatus('todo');
      setPriority('medium');
      setCategory('feature');
      setDueDate('');
      setAssigneeIds(isManagerOrAdmin ? [] : [currentUser.id]);
      setTagsInput('');
      setSubtasks([]);
      return;
    }
    const found = templates.find((t) => String(t.id) === rawId);
    if (found) {
      applyTemplateFields(found);
    }
  };

  const handleOpenSaveAsTemplate = () => {
    setError('');
    setTemplateNameInput((prev) => prev || title.trim());
    if (!templateDueOffsetInput && dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(`${dueDate}T00:00:00`);
      const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays >= 0 && diffDays <= 365) {
        setTemplateDueOffsetInput(String(diffDays));
      }
    }
    setSaveTemplateOpen(true);
  };

  const handleConfirmSaveTemplate = async () => {
    if (!templateNameInput.trim()) {
      setError('Please enter a template name.');
      return;
    }
    if (!title.trim()) {
      setError('Enter a task title before saving as a template.');
      return;
    }

    let dueOffsetDays: number | null = null;
    if (templateDueOffsetInput.trim() !== '') {
      const n = Number(templateDueOffsetInput);
      if (!Number.isInteger(n) || n < 0 || n > 365) {
        setError('Template due offset must be an integer between 0 and 365 days.');
        return;
      }
      dueOffsetDays = n;
    }

    setSavingTemplate(true);
    setError('');
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    try {
      const created = await api.createTaskTemplate({
        name: templateNameInput.trim(),
        title: title.trim(),
        description: description.trim(),
        projectId: projectId || null,
        assigneeIds,
        priority,
        category,
        status,
        tags,
        subtasks: subtasks.map((s) => ({ ...s, done: false })),
        dueOffsetDays,
      });
      onTemplateSaved?.(created);
      onNotifyToast(`Saved template "${created.name}"`);
      setSaveTemplateOpen(false);
      setTemplateNameInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const toggleAssignee = (uid: number) => {
    if (!isManagerOrAdmin) return;
    setAssigneeIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleAddSubtask = () => {
    const clean = newSubtask.trim();
    if (!clean) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: clean, done: false },
    ]);
    setNewSubtask('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    setSaving(true);
    setError('');
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    try {
      const saved = task
        ? await api.updateTask(task.id, {
            projectId,
            title: title.trim(),
            description: description.trim(),
            assigneeIds,
            dueDate,
            priority,
            category,
            status,
            tags,
            subtasks,
            archived,
          })
        : await api.createTask({
            projectId,
            title: title.trim(),
            description: description.trim(),
            assigneeIds,
            dueDate,
            priority,
            category,
            status,
            tags,
            subtasks,
          });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!task || !files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const updated = await api.uploadAttachments(task.id, files);
      onSaved(updated);
      onNotifyToast(`Uploaded ${files.length} file(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handlePostComment = async () => {
    if (!task || !commentText.trim()) return;
    try {
      const created = await api.addComment(task.id, commentText.trim());
      setComments((prev) => [...prev, created]);
      setCommentText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment.');
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await api.deleteTask(task.id);
      onDeleted(task.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task.');
      setSaving(false);
    }
  };

  const handleRemind = async () => {
    if (!task) return;
    try {
      const res = await api.sendTaskReminder(task.id);
      onNotifyToast(`Sent reminder to ${res.count} assignee(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reminder.');
    }
  };

  const fieldClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[var(--accent)] disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="ws-card max-h-[90vh] w-full max-w-3xl overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {task ? 'Task Details & Updates' : 'Create New Task'}
            </h2>
            {task?.dueDate && (
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Target Due: {formatDisplayDate(task.dueDate, dateFormat)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task && isManagerOrAdmin && task.status !== 'completed' && (
              <button
                type="button"
                onClick={handleRemind}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5 ws-accent-text" />
                Remind Assignees
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close task modal"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5 p-6">
          {!task && templates.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="task-template-picker"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <LayoutTemplate className="h-3.5 w-3.5 ws-accent-text" />
                  Start from Template
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pre-fills subtasks, description, and defaults
                </span>
              </div>
              <select
                id="task-template-picker"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelectChange(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Blank task (custom)</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={String(tpl.id)}>
                    {tpl.name} ({tpl.subtasks.length} subtasks)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Task Title
            </label>
            <input
              type="text"
              required
              disabled={Boolean(task && !isManagerOrAdmin)}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement OAuth session audit"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--accent)] disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Project
              </label>
              <select
                disabled={Boolean(task && !isManagerOrAdmin)}
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
                className={fieldClass}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Status
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                disabled={Boolean(task && !isManagerOrAdmin)}
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
                Due Date
              </label>
              <input
                type="date"
                disabled={Boolean(task && !isManagerOrAdmin)}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                disabled={Boolean(task && !isManagerOrAdmin)}
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
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="mobile, security, q4"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Multi-member Assignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Assignees ({assigneeIds.length} selected)
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {users.map((u) => {
                const selected = assigneeIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={!isManagerOrAdmin}
                    onClick={() => toggleAssignee(u.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:cursor-default ${
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
              Description & Instructions
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Acceptance criteria, rollout notes, or handoff instructions..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Sub-task Checklist */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                <CheckSquare className="h-4 w-4 ws-accent-text" />
                Sub-tasks ({subtasks.filter((s) => s.done).length}/{subtasks.length})
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <label className="flex flex-1 items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sub.done}
                      onChange={() =>
                        setSubtasks((prev) =>
                          prev.map((item) =>
                            item.id === sub.id ? { ...item, done: !item.done } : item
                          )
                        )
                      }
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                    <span
                      className={
                        sub.done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100'
                      }
                    >
                      {sub.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSubtasks((prev) => prev.filter((item) => item.id !== sub.id))}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
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
                  placeholder="Add actionable checklist item..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
          </div>

          {task && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              Archive this task
            </label>
          )}

          {saveTemplateOpen && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <LayoutTemplate className="h-3.5 w-3.5 ws-accent-text" />
                  Save Current Structure as Reusable Template
                </span>
                <button
                  type="button"
                  onClick={() => setSaveTemplateOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateNameInput}
                    onChange={(e) => setTemplateNameInput(e.target.value)}
                    placeholder="e.g., Sprint QA Release Checklist"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Due Offset (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={templateDueOffsetInput}
                    onChange={(e) => setTemplateDueOffsetInput(e.target.value)}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaveTemplateOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingTemplate}
                  onClick={() => void handleConfirmSaveTemplate()}
                  className="rounded-lg px-3.5 py-1.5 text-xs font-semibold ws-accent-bg disabled:opacity-60 cursor-pointer"
                >
                  {savingTemplate ? 'Saving Template...' : 'Save Template'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {task && (isManagerOrAdmin || task.createdById === currentUser.id) && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/60 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Task
                </button>
              )}
              {!saveTemplateOpen && (
                <button
                  type="button"
                  onClick={handleOpenSaveAsTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <LayoutTemplate className="h-3.5 w-3.5 ws-accent-text" /> Save as Template
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg px-5 py-2 text-xs font-semibold ws-accent-bg disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>

        {/* Attachments & Comments */}
        {task && (
          <div className="space-y-5 border-t border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/70">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <Paperclip className="h-4 w-4 ws-accent-text" />
                  Attachments ({task.attachments.length})
                </div>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading...' : 'Upload File'}
                  <input
                    type="file"
                    multiple
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) => void handleUploadFiles(e.target.files)}
                  />
                </label>
              </div>
              {task.attachments.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {task.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                          {att.name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {(att.size / 1024).toFixed(1)} KB · Uploaded by {att.uploadedByName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void api.downloadAttachment(att.url, att.name)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold ws-accent-text hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Download className="h-3 w-3" /> Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Comments & Progress Updates ({comments.length})
              </div>
              <div className="mt-2.5 space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {c.authorName}{' '}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          ({c.authorRole})
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                        {formatRelativeTime(c.createdAt, dateFormat)}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{c.message}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handlePostComment();
                    }
                  }}
                  placeholder="Write a progress update or comment..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void handlePostComment()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" /> Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
