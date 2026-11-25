import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Bell,
  Download,
  Eye,
  EyeOff,
  FolderInput,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { formatDue, getInitials, PRIORITIES, STATUSES } from '../constants';
import {
  DateFormatPref,
  DefaultTaskSortPref,
  ProjectRecord,
  TaskFilterState,
  TaskRecord,
  TaskStatus,
  UserProfile,
} from '../types';
import { downloadTasksCsv } from '../utils/csvExport';

interface ListViewProps {
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  users: UserProfile[];
  filters: TaskFilterState;
  dateFormat: DateFormatPref;
  taskSort: DefaultTaskSortPref;
  showCompleted: boolean;
  isManagerOrAdmin: boolean;
  onFiltersChange: (next: TaskFilterState) => void;
  onTaskSortChange: (sort: DefaultTaskSortPref) => void;
  onShowCompletedChange: (show: boolean) => void;
  onOpenTask: (task: TaskRecord) => void;
  onCreateTask: () => void;
  onStatusChange: (taskId: number, status: TaskStatus) => Promise<void>;
  onSendReminder: (taskId: number) => Promise<void>;
  onBulkUpdate: (
    taskIds: number[],
    updates: { status?: TaskStatus; projectId?: number }
  ) => Promise<void>;
  onBulkDelete: (taskIds: number[]) => Promise<void>;
}

export const ListView: React.FC<ListViewProps> = ({
  tasks,
  projects,
  users,
  filters,
  dateFormat,
  taskSort,
  showCompleted,
  isManagerOrAdmin,
  onFiltersChange,
  onTaskSortChange,
  onShowCompletedChange,
  onOpenTask,
  onCreateTask,
  onStatusChange,
  onSendReminder,
  onBulkUpdate,
  onBulkDelete,
}) => {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>('in_progress');
  const [bulkProjectId, setBulkProjectId] = useState<number>(projects[0]?.id || 0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const visibleIdSet = new Set(tasks.map((t) => t.id));
  const activeSelectedIds = selectedIds.filter((id) => visibleIdSet.has(id));
  const allVisibleSelected = tasks.length > 0 && activeSelectedIds.length === tasks.length;
  const someVisibleSelected =
    activeSelectedIds.length > 0 && activeSelectedIds.length < tasks.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  useEffect(() => {
    if (projects.length > 0 && !projects.some((p) => p.id === bulkProjectId)) {
      setBulkProjectId(projects[0].id);
    }
  }, [projects, bulkProjectId]);

  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags))).sort();

  const toggleSelectAll = () => {
    setConfirmingDelete(false);
    setBulkError('');
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tasks.map((t) => t.id));
    }
  };

  const toggleRow = (id: number) => {
    setConfirmingDelete(false);
    setBulkError('');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setConfirmingDelete(false);
    setBulkError('');
  };

  const handleBulkStatusApply = async () => {
    if (activeSelectedIds.length < 2) return;
    setBulkBusy(true);
    setBulkError('');
    try {
      await onBulkUpdate(activeSelectedIds, { status: bulkStatus });
      setConfirmingDelete(false);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Unable to update selected tasks.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkProjectMove = async () => {
    if (activeSelectedIds.length < 2 || !bulkProjectId) return;
    setBulkBusy(true);
    setBulkError('');
    try {
      await onBulkUpdate(activeSelectedIds, { projectId: bulkProjectId });
      setConfirmingDelete(false);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Unable to move selected tasks.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (activeSelectedIds.length < 2) return;
    setBulkBusy(true);
    setBulkError('');
    try {
      await onBulkDelete(activeSelectedIds);
      setSelectedIds([]);
      setConfirmingDelete(false);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Unable to delete selected tasks.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportCsv = () => {
    downloadTasksCsv(tasks, projects, users, filters);
  };

  const selectClass =
    'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

  return (
    <div className="ws-stack">
      {/* Filter Toolbar */}
      <div className="ws-card ws-card-pad flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
            placeholder="Search tasks, tags, notes..."
            className="w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[var(--accent)] focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
          />

          <select
            value={filters.projectId}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                projectId: e.target.value === 'all' ? 'all' : Number(e.target.value),
              })
            }
            className={selectClass}
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                status: e.target.value as TaskFilterState['status'],
              })
            }
            className={selectClass}
          >
            <option value="all">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={filters.priority}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                priority: e.target.value as TaskFilterState['priority'],
              })
            }
            className={selectClass}
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            value={filters.assigneeId}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                assigneeId: e.target.value === 'all' ? 'all' : Number(e.target.value),
              })
            }
            className={selectClass}
          >
            <option value="all">All Assignees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {allTags.length > 0 && (
            <select
              value={filters.tag}
              onChange={(e) => onFiltersChange({ ...filters, tag: e.target.value })}
              className={selectClass}
            >
              <option value="all">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          )}

          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-800">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              aria-label="Sort tasks by"
              value={taskSort}
              onChange={(e) => onTaskSortChange(e.target.value as DefaultTaskSortPref)}
              className="bg-transparent py-2 pr-1 text-xs font-medium text-slate-700 outline-none dark:text-slate-200"
            >
              <option value="due_date">Sort: Due date</option>
              <option value="priority">Sort: Priority</option>
              <option value="updated">Sort: Recently updated</option>
              <option value="title">Sort: Title</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => onShowCompletedChange(!showCompleted)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold cursor-pointer ${
              showCompleted
                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                : 'ws-accent-soft'
            }`}
          >
            {showCompleted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showCompleted ? 'Completed: Shown' : 'Completed: Hidden'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSelectedIds.length === 1 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              1 selected — select another for bulk actions
            </span>
          )}
          <button
            type="button"
            disabled={tasks.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onCreateTask}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {activeSelectedIds.length >= 2 && (
        <div
          role="region"
          aria-label="Bulk task actions"
          className="ws-card border-slate-800 bg-[#0F172A] px-4 py-3 text-white shadow-lg dark:border-slate-700"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-blue-400 tabular-nums">
                {activeSelectedIds.length} tasks selected
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Bulk status target"
                  disabled={bulkBusy}
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as TaskStatus)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white outline-none focus:border-[var(--accent)]"
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkStatusApply()}
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ws-accent-bg disabled:opacity-50 cursor-pointer"
                >
                  Update Status
                </button>
              </div>

              {isManagerOrAdmin && projects.length > 0 && (
                <div className="flex items-center gap-1.5 border-l border-slate-700 pl-2.5">
                  <select
                    aria-label="Bulk target project"
                    disabled={bulkBusy}
                    value={bulkProjectId}
                    onChange={(e) => setBulkProjectId(Number(e.target.value))}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white outline-none focus:border-[var(--accent)]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void handleBulkProjectMove()}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                    Move to Project
                  </button>
                </div>
              )}

              <div className="border-l border-slate-700 pl-2.5">
                {!confirmingDelete ? (
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-600/30 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Selected
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkDeleteConfirm()}
                      className="whitespace-nowrap rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 cursor-pointer"
                    >
                      {bulkBusy ? 'Deleting...' : `Confirm Delete (${activeSelectedIds.length})`}
                    </button>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {bulkError && (
            <div className="mt-2 rounded-lg border border-red-400/40 bg-red-950/60 px-3 py-1.5 text-xs text-red-200">
              {bulkError}
            </div>
          )}
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="ws-card overflow-x-auto">
        {tasks.length === 0 ? (
          <div className="py-14 text-center">
            <div className="font-display text-base font-bold text-slate-800 dark:text-slate-100">
              No matching tasks found
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Adjust your active filters or create a new task to get started.
            </p>
            <button
              type="button"
              onClick={onCreateTask}
              className="mt-4 rounded-lg px-4 py-2 text-xs font-semibold ws-accent-bg cursor-pointer"
            >
              Create Task
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
              <tr>
                <th className="w-10 ws-cell">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Select all visible tasks"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 dark:border-slate-600 dark:bg-slate-800 cursor-pointer"
                  />
                </th>
                <th className="ws-cell">Task</th>
                <th className="ws-cell">Project</th>
                <th className="ws-cell">Assignees</th>
                <th className="ws-cell">Status</th>
                <th className="ws-cell">Priority</th>
                <th className="ws-cell">Due Date</th>
                <th className="ws-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.map((task) => {
                const proj = projectMap.get(task.projectId);
                const prio = PRIORITIES.find((p) => p.id === task.priority);
                const due = formatDue(task.dueDate, dateFormat);
                const subTotal = task.subtasks.length;
                const subDone = task.subtasks.filter((s) => s.done).length;
                const subPct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;
                const isSelected = activeSelectedIds.includes(task.id);
                const assignees = (
                  task.assigneeIds.length > 0
                    ? task.assigneeIds
                    : task.assigneeId
                      ? [task.assigneeId]
                      : []
                )
                  .map((id) => userMap.get(id))
                  .filter((u): u is UserProfile => Boolean(u));

                return (
                  <tr
                    key={task.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="ws-cell align-top">
                      <input
                        type="checkbox"
                        aria-label={`Select ${task.title}`}
                        checked={isSelected}
                        onChange={() => toggleRow(task.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 dark:border-slate-600 dark:bg-slate-800 cursor-pointer"
                      />
                    </td>

                    <td className="max-w-xs ws-cell">
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="text-left font-semibold text-slate-900 hover:underline dark:text-slate-100 cursor-pointer"
                      >
                        {task.title}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {task.archived && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            Archived
                          </span>
                        )}
                        {task.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] text-slate-500 dark:text-slate-400"
                          >
                            #{tag}
                          </span>
                        ))}
                        {task.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            <Paperclip className="h-3 w-3" />
                            {task.attachments.length}
                          </span>
                        )}
                      </div>
                      {subTotal > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${subPct}%`, backgroundColor: 'var(--accent)' }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {subDone}/{subTotal}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="whitespace-nowrap ws-cell text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: proj?.color || '#2563EB' }}
                        />
                        {proj?.name || 'Workspace'}
                      </span>
                    </td>

                    <td className="ws-cell">
                      <div className="flex items-center gap-1.5">
                        {assignees.length > 0 ? (
                          <div className="flex -space-x-1.5">
                            {assignees.slice(0, 3).map((u) => (
                              <span
                                key={u.id}
                                title={u.name}
                                className="flex h-6 w-6 items-center justify-center rounded-full border border-white bg-[#0F172A] font-mono text-[10px] font-semibold text-white dark:border-slate-900 dark:bg-slate-700"
                              >
                                {getInitials(u.name)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                        {assignees.length === 1 && (
                          <span className="text-slate-700 dark:text-slate-300">
                            {assignees[0].name}
                          </span>
                        )}
                        {assignees.length > 1 && (
                          <span className="text-slate-500 dark:text-slate-400">
                            +{assignees.length}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="ws-cell">
                      <select
                        value={task.status}
                        onChange={(e) => void onStatusChange(task.id, e.target.value as TaskStatus)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="ws-cell">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          prio?.badgeClass || ''
                        }`}
                      >
                        {prio?.label}
                      </span>
                    </td>

                    <td className="whitespace-nowrap ws-cell">
                      <div
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          due.state === 'over' && task.status !== 'completed'
                            ? 'text-red-600 dark:text-red-400'
                            : due.state === 'today'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {due.formatted}
                      </div>
                      {due.text !== due.formatted && due.state !== 'none' && (
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {due.text}
                        </div>
                      )}
                    </td>

                    <td className="whitespace-nowrap ws-cell text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {isManagerOrAdmin && task.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => void onSendReminder(task.id)}
                            title="Send reminder notification to assignees"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenTask(task)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
